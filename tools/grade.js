#!/usr/bin/env node
/**
 * grade.js — teacher-side batch grader for Karel assignments.
 *
 * Reads a roster of students and their repositories, pulls each repo, and grades
 * every submissions/<id>.js against the matching assignment's sealed solution —
 * headlessly, using the same simulator the browser uses (stanfordkarel.js →
 * gradeKarel). Each submission runs in a worker with a timeout, so a student's
 * infinite loop can't hang the run. Emits a JSON gradebook and a printed table.
 *
 * Usage:
 *   node tools/grade.js --roster tools/roster.json
 *   node tools/grade.js --roster r.json --cache .grade-cache --out gradebook.json --timeout 5000
 *   node tools/grade.js --roster r.json --no-pull      # don't git-pull existing clones
 *   node tools/grade.js --roster r.json --verbose      # print every problem's pass/fail as it's checked
 *
 * Single file (no roster, no clone) — grade one submission by path or URL:
 *   node tools/grade.js --file submissions/lab02.js
 *   node tools/grade.js --file https://github.com/ha2700/repo/blob/main/lab02.js
 *   node tools/grade.js --file <url> --id collect-all      # override the assignment id
 * A github.com/<owner>/<repo>/blob/<ref>/<path> URL is rewritten to its
 * raw.githubusercontent.com form automatically; a raw URL is fetched as given.
 * The assignment is taken from the file's `// assignment: <id>` header unless
 * --id is passed. Exit status is 0 when the submission is solved, 1 otherwise.
 *
 * Roster format (JSON array):
 *   [ { "name": "Ada Lovelace", "github": "ada", "repoUrl": "https://github.com/ada/karel.git" } ]
 * `repoUrl` may also be a local path (handy for testing) — it's used in place, no clone.
 *
 * The grade of record: a submission counts for full points only when gradeKarel
 * reports solved (final state matches the solution on the assignment's `check`
 * aspects, and any pinned `end` pose holds).
 */
import { Worker } from "node:worker_threads";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { assignments, getAssignment } from "../assignments/index.js";
import { unsealSolution } from "../stanfordkarel.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKER = join(HERE, "grade-worker.js");

// ── args ─────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const opts = { roster: "tools/roster.json", cache: ".grade-cache", out: "gradebook.json", timeout: 5000, pull: true, file: null, id: null, verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--roster") opts.roster = argv[++i];
    else if (a === "--cache") opts.cache = argv[++i];
    else if (a === "--out") opts.out = argv[++i];
    else if (a === "--timeout") opts.timeout = Number(argv[++i]);
    else if (a === "--no-pull") opts.pull = false;
    else if (a === "--verbose" || a === "-v") opts.verbose = true;
    else if (a === "--file") opts.file = argv[++i];
    else if (a === "--id") opts.id = argv[++i];
    else if (a === "-h" || a === "--help") { printHelp(); process.exit(0); }
    else { console.error(`Unknown argument: ${a}`); process.exit(1); }
  }
  return opts;
}
function printHelp() {
  console.log("Usage: node tools/grade.js --roster <file> [--cache <dir>] [--out <file>] [--timeout <ms>] [--no-pull] [--verbose]");
  console.log("       node tools/grade.js --file <path-or-url> [--id <assignmentId>] [--timeout <ms>] [--verbose]");
}

// Rewrite a github.com blob URL to its raw.githubusercontent.com equivalent;
// leave a raw URL (or anything else) untouched.
//   https://github.com/<o>/<r>/blob/<ref>/<path>  →
//   https://raw.githubusercontent.com/<o>/<r>/<ref>/<path>
function toRawUrl(url) {
  const m = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
  return m ? `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}` : url;
}

// Load a submission's source from a local path or an http(s) URL.
async function loadSource(target) {
  if (/^https?:\/\//i.test(target)) {
    const url = toRawUrl(target);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`fetch ${url} → ${resp.status} ${resp.statusText}`);
    return { source: await resp.text(), origin: url };
  }
  return { source: readFileSync(target, "utf8"), origin: resolve(target) };
}

// ── repo access ──────────────────────────────────────────────────────────────
// Return a local directory for the student's repo, cloning/pulling as needed.
// A repoUrl that is already a local directory is used in place (for testing).
function ensureRepo(entry, cacheDir, pull) {
  const key = entry.github || entry.name || entry.repoUrl;
  if (entry.repoUrl && existsSync(entry.repoUrl) && statSync(entry.repoUrl).isDirectory()) {
    return { dir: resolve(entry.repoUrl), note: null };
  }
  if (!entry.repoUrl) return { dir: null, note: "no repoUrl in roster" };
  const dest = join(cacheDir, key.replace(/[^\w.-]/g, "_"));
  try {
    if (existsSync(join(dest, ".git"))) {
      if (pull) execFileSync("git", ["-C", dest, "pull", "--ff-only", "--quiet"], { stdio: "pipe" });
    } else {
      mkdirSync(cacheDir, { recursive: true });
      execFileSync("git", ["clone", "--quiet", "--depth", "1", entry.repoUrl, dest], { stdio: "pipe" });
    }
    return { dir: dest, note: null };
  } catch (err) {
    const msg = (err.stderr?.toString() || err.message || "").trim().split("\n").pop();
    return { dir: null, note: `git failed: ${msg}` };
  }
}

// Read submissions/*.js from a repo dir → [{ id, file, source }].
// The assignment id comes from a `// assignment: <id>` header line, else the
// filename. Header comments stay in `source` — they're harmless to compile.
function readSubmissions(repoDir) {
  const subsDir = join(repoDir, "submissions");
  if (!existsSync(subsDir)) return [];
  return readdirSync(subsDir)
    .filter(f => f.endsWith(".js"))
    .map(f => {
      const source = readFileSync(join(subsDir, f), "utf8");
      const m = source.match(/^\s*\/\/\s*assignment:\s*(\S+)\s*$/m);
      const id = m ? m[1] : f.replace(/\.js$/, "");
      return { id, file: f, source };
    });
}

// ── grading ──────────────────────────────────────────────────────────────────
// Build the worker payload for an assignment. A multi-problem (lesson) assignment
// unseals each problem's solution and asks the worker to unwrap the framed
// `problem_<n>()` (1-based, by position) from the submission; a standalone
// assignment sends one.
function workerPayload(assignment, source) {
  if (Array.isArray(assignment.problems)) {
    return {
      programText: source,
      problems: assignment.problems.map(p => ({
        key: p.key,
        worldText: p.world,
        solutionText: unsealSolution(p.solution),
        check: p.check,
        end: p.end || null,
      })),
    };
  }
  return {
    worldText: assignment.world,
    programText: source,
    solutionText: unsealSolution(assignment.solution),
    check: assignment.check,
    end: assignment.end || null,
  };
}

// Run one submission in a worker, killed after `timeout` ms.
function gradeInWorker(assignment, source, timeout) {
  const workerData = workerPayload(assignment, source);
  return new Promise(res => {
    const worker = new Worker(WORKER, { workerData });
    let settled = false;
    const done = value => { if (!settled) { settled = true; worker.terminate(); res(value); } };
    const timer = setTimeout(() => done({ solved: false, error: "timeout" }), timeout);
    worker.on("message", r => { clearTimeout(timer); done(r); });
    worker.on("error", e => { clearTimeout(timer); done({ solved: false, error: e.message }); });
    worker.on("exit", () => { clearTimeout(timer); done({ solved: false, error: "worker exited" }); });
  });
}

// Collapse a worker result into a { solved, points, note } scoreline for an
// assignment. Multi-problem assignments sum the points of each solved problem;
// `solved` means every problem passed.
function scoreResult(assignment, r) {
  const max = assignment.points ?? 0;
  if (Array.isArray(assignment.problems)) {
    if (r.error && !r.perProblem) return { solved: false, points: 0, max, note: r.error };
    const per = r.perProblem || {};
    let points = 0, solvedCount = 0;
    const notes = [];
    for (const p of assignment.problems) {
      const pr = per[p.key] || { solved: false, error: "no result" };
      if (pr.solved) { points += p.points ?? 0; solvedCount++; }
      else notes.push(`${p.key}: ${pr.error || "wrong result"}`);
    }
    return {
      solved: solvedCount === assignment.problems.length,
      points, max,
      note: notes.join("; ") || `${solvedCount}/${assignment.problems.length} problems`,
    };
  }
  return {
    solved: r.solved,
    points: r.solved ? max : 0,
    max,
    note: r.error || (r.solved ? "" : "wrong result"),
  };
}

async function gradeStudent(entry, opts) {
  const { dir, note } = ensureRepo(entry, opts.cache, opts.pull);
  const results = {};
  const submitted = dir ? readSubmissions(dir) : [];
  const byId = new Map(submitted.map(s => [s.id, s]));

  for (const a of assignments) {
    const sub = byId.get(a.id);
    if (!sub) { results[a.id] = { solved: false, points: 0, max: a.points ?? 0, note: dir ? "no submission" : (note || "no repo") }; continue; }
    if (!getAssignment(sub.id)) { results[a.id] = { solved: false, points: 0, max: a.points ?? 0, note: "unknown assignment id" }; continue; }
    const r = await gradeInWorker(a, sub.source, opts.timeout);
    results[a.id] = scoreResult(a, r);
    if (opts.verbose) reportVerbose(a, r, a.id);
  }
  // Flag submissions that don't match any known assignment.
  for (const s of submitted) {
    if (!getAssignment(s.id)) results[`?${s.file}`] = { solved: false, points: 0, max: 0, note: `unknown assignment "${s.id}"` };
  }
  return { student: entry, repo: dir, repoNote: note, results };
}

// ── reporting ────────────────────────────────────────────────────────────────
// Print a per-problem pass/fail breakdown for one graded submission (stderr,
// alongside the progress log). A standalone assignment reports a single line; a
// lesson assignment reports one line per problem with its points or the reason
// it failed.
function reportVerbose(assignment, r, label) {
  const line = s => process.stderr.write(s + "\n");
  const checks = c => `[${(c && c.length ? c : ["beepers", "position", "direction", "colors"]).join(", ")}]`;
  line(`  ${label}`);
  if (Array.isArray(assignment.problems)) {
    if (r.error && !r.perProblem) { line(`    ✗ (all)  — ${r.error}`); return; }
    const per = r.perProblem || {};
    const w = Math.max(...assignment.problems.map(p => p.key.length));
    for (const p of assignment.problems) {
      const pr = per[p.key] || { solved: false, error: "no result" };
      line(pr.solved
        ? `    ✓ ${p.key.padEnd(w)}  ${p.points ?? 0} pts  ${checks(p.check)}`
        : `    ✗ ${p.key.padEnd(w)}  ${checks(p.check)}  — ${pr.error || "wrong result"}`);
    }
  } else {
    line(r.solved
      ? `    ✓ solved  ${checks(assignment.check)}`
      : `    ✗ ${checks(assignment.check)}  — ${r.error || "wrong result"}`);
  }
}

function printTable(gradebook) {
  const ids = assignments.map(a => a.id);
  const nameW = Math.max(7, ...gradebook.map(g => (g.student.name || g.student.github || "").length));
  const cell = (s, w) => String(s).padEnd(w);
  const head = cell("Student", nameW) + " | " + ids.map(id => cell(id, Math.max(id.length, 6))).join(" | ") + " | Total";
  console.log("\n" + head);
  console.log("-".repeat(head.length));
  for (const g of gradebook) {
    let got = 0, max = 0;
    const cells = ids.map(id => {
      const r = g.results[id] || { points: 0, max: 0 };
      got += r.points; max += r.max;
      const mark = r.solved ? "✓" : (r.note === "no submission" ? "·" : "✗");
      return cell(`${mark} ${r.points}/${r.max}`, Math.max(id.length, 6));
    });
    console.log(cell(g.student.name || g.student.github, nameW) + " | " + cells.join(" | ") + " | " + `${got}/${max}`);
  }
  console.log("\nLegend: ✓ solved · no submission ✗ wrong/error\n");
}

// Grade a single submission file (path or URL) against one assignment, print a
// one-line verdict, and return true iff it was solved. No roster, no clone.
async function gradeSingleFile(opts) {
  let source, origin;
  try {
    ({ source, origin } = await loadSource(opts.file));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const headerId = (source.match(/^\s*\/\/\s*assignment:\s*(\S+)\s*$/m) || [])[1];
  const id = opts.id || headerId;
  if (!id) {
    console.error("No `// assignment: <id>` header in the file; pass --id <assignmentId>.");
    process.exit(1);
  }
  const assignment = getAssignment(id);
  if (!assignment) {
    console.error(`Unknown assignment id: ${id}`);
    process.exit(1);
  }
  process.stderr.write(`Grading ${origin} as "${id}"…${opts.verbose ? "\n" : " "}`);
  const r = await gradeInWorker(assignment, source, opts.timeout);
  if (opts.verbose) reportVerbose(assignment, r, id);
  process.stderr.write("done\n");
  const score = scoreResult(assignment, r);
  const mark = score.solved ? "✓" : "✗";
  console.log(`\n${mark} ${id}  ${score.points}/${score.max}${score.note ? `  — ${score.note}` : ""}`);
  return score.solved;
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.file) {
    const solved = await gradeSingleFile(opts);
    process.exit(solved ? 0 : 1);
  }
  if (!existsSync(opts.roster)) {
    console.error(`Roster not found: ${opts.roster}`);
    process.exit(1);
  }
  let roster;
  try {
    roster = JSON.parse(readFileSync(opts.roster, "utf8"));
  } catch (err) {
    console.error(`Could not parse roster ${opts.roster}: ${err.message}`);
    process.exit(1);
  }
  if (!Array.isArray(roster)) { console.error("Roster must be a JSON array."); process.exit(1); }

  const gradebook = [];
  for (const entry of roster) {
    process.stderr.write(`Grading ${entry.name || entry.github}…${opts.verbose ? "\n" : " "}`);
    const g = await gradeStudent(entry, opts);
    gradebook.push(g);
    process.stderr.write((g.repo ? "done" : `skipped (${g.repoNote || "no repo"})`) + "\n");
  }

  writeFileSync(opts.out, JSON.stringify({ gradedAt: new Date().toISOString(), assignments: assignments.map(a => ({ id: a.id, points: a.points })), gradebook }, null, 2));
  printTable(gradebook);
  console.log(`Wrote ${opts.out}`);
}

main().catch(err => { console.error(err); process.exit(1); });
