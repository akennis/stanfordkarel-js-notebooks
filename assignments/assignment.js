/**
 * assignment.js — renders one graded assignment page.
 *
 * Layered on the same simulator as the lessons, but where a lesson challenge
 * (lessons/lesson.js → renderChallenge) is purely formative, an assignment adds
 * a submit panel that produces the file a student commits to their own repo. The
 * in-browser ✓ here is practice only; the grade of record comes from the
 * teacher-side re-grade (tools/grade-lessons.js).
 *
 * A lesson assignment (assignments/lesson-NN.js) bundles THREE problems keyed
 * simple / moderate / complex — one card each — plus a SINGLE combined
 * submission textarea at the page bottom. That one file auto-frames all three
 * solutions, each wrapped in an outer function that returns its main(k), so a
 * reviewer's grader can run and grade every problem from the one submission.
 *
 * Each problem ships its reference solution SEALED (see stanfordkarel.js /
 * tools/seal.js); we unseal it at runtime to build the goal GIF and to grade the
 * student's run — never printing the plaintext into the page.
 */
import { runKarel, runKarelInWorker, unsealSolution, compileProgram } from "../stanfordkarel.js";

const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

const DEFAULT_OPTS = { cellSize: 46, delay: 150 };

function autoSize(ta) {
  ta.style.height = "auto";
  ta.style.height = ta.scrollHeight + 2 + "px";
}

// Replace [from, to) with `text`, going through execCommand so the browser's
// native undo stack survives. `caret` defaults to the end of the inserted text.
function spliceText(ta, from, to, text, caret = from + text.length) {
  ta.setSelectionRange(from, to);
  let ok = false;
  try {
    ok = text === "" ? document.execCommand("delete") : document.execCommand("insertText", false, text);
  } catch { ok = false; }
  if (!ok) ta.value = ta.value.slice(0, from) + text + ta.value.slice(to);
  ta.setSelectionRange(caret, caret);
  autoSize(ta);
}

// Make the textarea feel like a code editor: Tab inserts two spaces instead of
// moving focus, Shift+Tab removes them, Enter carries the current line's indent
// (two deeper after an opening brace), and typing `}` on a blank line dedents.
function handleEditorKeys(e) {
  if (e.key !== "Tab" && e.key !== "Enter" && e.key !== "}") return;
  const ta = e.target;
  const start = ta.selectionStart, end = ta.selectionEnd;
  const lineStart = ta.value.lastIndexOf("\n", start - 1) + 1;
  const indent = ta.value.slice(lineStart, start).match(/^[ \t]*/)[0];

  if (e.key === "Tab") {
    e.preventDefault();
    if (!e.shiftKey) return spliceText(ta, start, end, "  ");
    const lead = ta.value.slice(lineStart).match(/^ {1,2}/);
    if (lead) spliceText(ta, lineStart, lineStart + lead[0].length, "", Math.max(lineStart, start - lead[0].length));
    return;
  }

  if (e.key === "Enter") {
    e.preventDefault();
    const opens = /[{([]$/.test(ta.value.slice(lineStart, start).trimEnd());
    const inner = indent + (opens ? "  " : "");
    // Between a just-opened brace and its closer, leave the closer on its own line.
    if (opens && /^[ \t]*[}\])]/.test(ta.value.slice(end))) {
      spliceText(ta, start, end, "\n" + inner + "\n" + indent, start + 1 + inner.length);
    } else {
      spliceText(ta, start, end, "\n" + inner);
    }
    return;
  }

  // `}` typed on an otherwise blank line snaps back one level.
  if (start === end && /^ +$/.test(indent) && indent.length === start - lineStart && indent.length >= 2) {
    e.preventDefault();
    spliceText(ta, start - 2, end, "}");
  }
}

function friendlyError(err) {
  if (err instanceof ReferenceError && /\bmain\b/.test(err.message)) return err.message;
  if (err instanceof SyntaxError) return "Syntax error: " + err.message;
  return err.message;
}

// Normalize both manifest shapes into { ..., problems: [...] }. A legacy
// single-problem assignment (assignments/collect-all.js) carries its world /
// prompt / solution at the top level; wrap it as one "problem" so the renderer
// below only ever deals with the array form.
function normalize(a) {
  if (Array.isArray(a.problems)) return a;
  return {
    ...a,
    problems: [{
      key: "solution", label: "Problem", points: a.points ?? 0,
      world: a.world, prompt: a.prompt, starter: a.starter,
      check: a.check, end: a.end, solution: a.solution,
    }],
  };
}

// The exact text a student commits as submissions/<id>.js. Every problem's code
// is wrapped in its own outer function `problem_<key>()` that returns the main()
// the student defined — so all three coexist in one file and a grader can run
// each independently by calling its wrapper. The header lines tag the file with
// the assignment id; the whole thing is valid JavaScript (helpers included).
function buildSubmission(a, values) {
  const rule = "─".repeat(58);
  let out =
    `// Karel submission — do not remove the header or the function wrappers.\n` +
    `// assignment: ${a.id}\n` +
    `// submittedAt: ${new Date().toISOString()}\n` +
    `//\n` +
    `// Each problem below is wrapped in an outer function that returns its\n` +
    `// main(k), so your instructor's grader can run and grade all three.\n`;
  for (const p of a.problems) {
    const body = (values[p.key] || "").replace(/\s*$/, "");
    out +=
      `\n// ${rule}\n` +
      `// Problem: ${p.key}${p.label ? ` (${p.label})` : ""}\n` +
      `// ${rule}\n` +
      `function problem_${p.key}() {\n` +
      `${body}\n` +
      `  return main;\n` +
      `}\n`;
  }
  return out;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;   // clipboard API blocked (e.g. file://) — the textarea is the fallback
  }
}

/**
 * Render an assignment manifest into `mount`.
 * @param {object} raw     Assignment manifest (lesson-NN.js or collect-all.js).
 * @param {Element} [mount]
 * @param {{isolate?:boolean}} [options]  isolate (default true) runs the
 *   student's code in a Web Worker so an endless loop can't freeze the page.
 */
export async function renderAssignment(raw, mount = document.getElementById("assignment"), { isolate = true } = {}) {
  const a = normalize(raw);
  const opts = a.opts || DEFAULT_OPTS;

  // Optional back-link to the companion lesson.
  if (a.lessonSlug) {
    const back = document.createElement("p");
    back.className = "lesson-link";
    back.innerHTML =
      `📘 Companion lesson: <a href="../lessons/${esc(a.lessonSlug)}.html">${esc(a.lessonTitle || a.lessonSlug)}</a>`;
    mount.appendChild(back);
  }

  // Live editor values by problem key, and per-card refreshers so any edit
  // updates the single combined submission at the bottom.
  const values = {};
  const submissionRefreshers = [];
  const refreshSubmission = () => submissionRefreshers.forEach(fn => fn());

  for (const p of a.problems) {
    await renderProblemCard(a, p, mount, { opts, isolate, values, refreshSubmission });
  }

  // ── Single combined submission for all problems ──────────────────────────
  const panel = document.createElement("div");
  panel.className = "submit-panel";
  panel.innerHTML =
    `<div class="panel-label">📤 Submit all ${a.problems.length} problems</div>` +
    `<p class="submit-help">This one file contains every problem, each wrapped so your ` +
      `instructor's grader can run them automatically. Commit it to your assignments ` +
      `repository as <code>submissions/${esc(a.id)}.js</code>:</p>` +
    `<textarea class="submission" readonly spellcheck="false"></textarea>` +
    `<div class="submit-controls">` +
      `<button type="button" class="copy-btn">📋 Copy submission</button>` +
      `<span class="copy-note"></span>` +
    `</div>` +
    `<details class="submit-how"><summary>How to submit</summary>` +
      `<p><strong>Git (preferred).</strong> Save the copied text as ` +
      `<code>submissions/${esc(a.id)}.js</code> in your repo, then:</p>` +
      `<pre class="code"><code>git add submissions/${esc(a.id)}.js\n` +
      `git commit -m "Submit ${esc(a.id)}"\n` +
      `git push</code></pre>` +
      `<p><strong>No git?</strong> Paste the same text into your shared Google Doc under a ` +
      `heading named <code>${esc(a.id)}</code>.</p>` +
      `<p class="submit-note">The ✓ on each problem is a practice check. Your grade comes from ` +
      `the code you actually submit, re-run by your instructor.</p>` +
    `</details>`;
  mount.appendChild(panel);

  const submission = panel.querySelector(".submission");
  const copyBtn = panel.querySelector(".copy-btn");
  const copyNote = panel.querySelector(".copy-note");

  submissionRefreshers.push(() => {
    submission.value = buildSubmission(a, values);
    autoSize(submission);
  });
  refreshSubmission();
  requestAnimationFrame(() => autoSize(submission));

  copyBtn.addEventListener("click", async () => {
    refreshSubmission();
    const ok = await copyText(submission.value);
    copyNote.textContent = ok ? "Copied to clipboard." : "Press Ctrl/Cmd-C to copy the text above.";
    if (!ok) { submission.focus(); submission.select(); }
    setTimeout(() => { copyNote.textContent = ""; }, 4000);
  });
}

// Render a single problem card: goal GIF, editor, Run, verdict. Wires the editor
// into `values[p.key]` and calls refreshSubmission() on every edit so the shared
// submission textarea stays current.
async function renderProblemCard(a, p, mount, { opts, isolate, values, refreshSubmission }) {
  const aspects = p.check || ["beepers", "position", "direction", "colors"];
  const storageKey = `karel-assignment:${a.id}:${p.key}`;
  const stub = p.starter != null ? p.starter : "function main(k) {\n  // your code here\n}\n";

  let solutionFn = null;
  try {
    solutionFn = compileProgram(unsealSolution(p.solution));
  } catch (err) {
    const e = document.createElement("div");
    e.className = "err";
    e.textContent = `Problem "${p.key}" could not be loaded: ${friendlyError(err)}`;
    mount.appendChild(e);
    values[p.key] = "";
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "challenge assignment-card";
  wrap.innerHTML =
    `<div class="chal-head">` +
      `<span class="chal-badge level-${esc(p.key)}">${esc(p.label || p.key)}</span>` +
      `<div class="chal-prompt">${p.prompt || ""} ` +
      `<span class="points">Worth ${p.points ?? 0} points.</span></div></div>` +
    `<div class="chal-grid">` +
      `<section class="chal-goal">` +
        `<div class="panel-label">🎯 Goal — make Karel do this</div>` +
        `<div class="render goal-render"><span class="status">Loading goal…</span></div>` +
      `</section>` +
      `<section class="chal-work">` +
        `<div class="panel-label">Your code</div>` +
        `<textarea class="editor" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off"></textarea>` +
        `<div class="chal-controls">` +
          `<button type="button" class="run-btn">▶ Run</button>` +
          `<button type="button" class="reset-btn" title="Restore the starter code">Reset</button>` +
          `<span class="verdict"></span>` +
        `</div>` +
        `<div class="panel-label your-label">Your result</div>` +
        `<div class="render your-render"><span class="status muted">Run your code to see Karel go.</span></div>` +
      `</section>` +
    `</div>`;
  mount.appendChild(wrap);

  const editor = wrap.querySelector(".editor");
  const goalRender = wrap.querySelector(".goal-render");
  const yourRender = wrap.querySelector(".your-render");
  const verdict = wrap.querySelector(".verdict");
  const runBtn = wrap.querySelector(".run-btn");
  const resetBtn = wrap.querySelector(".reset-btn");

  editor.value = localStorage.getItem(storageKey) ?? stub;
  values[p.key] = editor.value;

  requestAnimationFrame(() => autoSize(editor));
  editor.addEventListener("input", () => {
    autoSize(editor);
    values[p.key] = editor.value;
    localStorage.setItem(storageKey, editor.value);
    refreshSubmission();
  });
  editor.addEventListener("keydown", handleEditorKeys);
  resetBtn.addEventListener("click", () => {
    editor.value = stub;
    values[p.key] = editor.value;
    localStorage.setItem(storageKey, editor.value);
    autoSize(editor);
    refreshSubmission();
    editor.focus();
  });

  // Build the goal GIF from the (unsealed, never shown) solution.
  try {
    const img = await runKarel(p.world, solutionFn,
      { ...opts, solution: solutionFn, check: aspects, end: p.end });
    goalRender.replaceChildren(img);
  } catch (err) {
    goalRender.innerHTML = `<div class="err">Could not build goal: ${esc(friendlyError(err))}</div>`;
  }

  runBtn.addEventListener("click", async () => {
    runBtn.disabled = true;
    verdict.className = "verdict";
    verdict.textContent = "";
    yourRender.replaceChildren(
      Object.assign(document.createElement("span"), { className: "status", textContent: "Running…" })
    );
    try {
      compileProgram(editor.value);
    } catch (err) {
      yourRender.innerHTML = `<div class="err">${esc(friendlyError(err))}</div>`;
      runBtn.disabled = false;
      return;
    }
    try {
      const gradeOpts = { ...opts, solution: solutionFn, check: aspects, end: p.end };
      const img = isolate
        ? await runKarelInWorker(p.world, editor.value, gradeOpts)
        : await runKarel(p.world, compileProgram(editor.value), gradeOpts);
      yourRender.replaceChildren(img);
      if (img.dataset.error) {
        const e = document.createElement("div");
        e.className = "err";
        e.textContent = "Karel stopped early: " + img.dataset.error;
        yourRender.appendChild(e);
      }
      if (img.dataset.solved === "true") {
        verdict.className = "verdict ok";
        verdict.textContent = "✓ Matches the goal — ready to submit!";
      } else {
        verdict.className = "verdict no";
        verdict.textContent = "✗ Not quite — compare with the goal and try again.";
      }
    } catch (err) {
      yourRender.innerHTML = `<div class="err">Error: ${esc(friendlyError(err))}</div>`;
    } finally {
      runBtn.disabled = false;
    }
  });
}
