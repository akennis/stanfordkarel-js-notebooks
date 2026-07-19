/**
 * assignment.js — renders one graded assignment page.
 *
 * Layered on the same simulator as the lessons, but where a lesson challenge
 * (lessons/lesson.js → renderChallenge) is purely formative, an assignment adds
 * a submit panel that produces the file a student commits to their own repo. The
 * in-browser ✓ here is practice only; the grade of record comes from the
 * teacher-side re-grade (tools/grade.js).
 *
 * The manifest ships its reference solution SEALED (see stanfordkarel.js /
 * tools/seal.js); we unseal it at runtime to build the goal GIF and to grade the
 * student's run — never printing the plaintext into the page.
 */
import { runKarel, runKarelInWorker, unsealSolution, compileProgram } from "../stanfordkarel.js";

const esc = s => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

const DEFAULT_OPTS = { cellSize: 46, delay: 150 };

function autoSize(ta) {
  ta.style.height = "auto";
  ta.style.height = ta.scrollHeight + 2 + "px";
}

// Tab inserts two spaces instead of moving focus, so the editor feels like code.
function handleTab(e) {
  if (e.key !== "Tab") return;
  e.preventDefault();
  const ta = e.target;
  const start = ta.selectionStart, end = ta.selectionEnd;
  ta.value = ta.value.slice(0, start) + "  " + ta.value.slice(end);
  ta.selectionStart = ta.selectionEnd = start + 2;
  autoSize(ta);
}

function friendlyError(err) {
  if (err instanceof ReferenceError && /\bmain\b/.test(err.message)) return err.message;
  if (err instanceof SyntaxError) return "Syntax error: " + err.message;
  return err.message;
}

// The exact text a student commits as submissions/<id>.js. The header comments
// tag the file so the grader knows which assignment it answers; the rest is the
// student's program verbatim, so the file is both human-readable and directly
// runnable by compileProgram (no export/import to strip).
function buildSubmission(id, code) {
  return (
    `// Karel submission — keep the three header lines below.\n` +
    `// assignment: ${id}\n` +
    `// submittedAt: ${new Date().toISOString()}\n` +
    code.replace(/\s*$/, "") + "\n"
  );
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
 * @param {object} a       Assignment manifest (see assignments/collect-all.js).
 * @param {Element} [mount]
 * @param {{isolate?:boolean}} [options]  isolate (default true) runs the
 *   student's code in a Web Worker so an endless loop can't freeze the page.
 */
export async function renderAssignment(a, mount = document.getElementById("assignment"), { isolate = true } = {}) {
  const aspects = a.check || ["beepers", "position", "direction", "colors"];
  const opts = a.opts || DEFAULT_OPTS;
  const storageKey = "karel-assignment:" + a.id;
  const stub = a.starter != null ? a.starter : "function main(k) {\n  // your code here\n}\n";

  // Unseal + compile the reference solution once: used both to draw the goal and
  // to grade the student's run. Kept in this closure, never written to the DOM.
  let solutionFn = null;
  try {
    solutionFn = compileProgram(unsealSolution(a.solution));
  } catch (err) {
    mount.innerHTML = `<div class="err">This assignment's solution could not be loaded: ${esc(friendlyError(err))}</div>`;
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "challenge assignment-card";
  wrap.innerHTML =
    `<div class="chal-head"><span class="chal-badge">Assignment</span>` +
      `<div class="chal-prompt">${a.prompt || ""} ` +
      `<span class="points">Worth ${a.points ?? 0} points.</span></div></div>` +
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
    `</div>` +
    `<div class="submit-panel">` +
      `<div class="panel-label">Submit</div>` +
      `<p class="submit-help">When you're happy with your solution, submit it by committing this ` +
        `file to your assignments repository as <code>submissions/${esc(a.id)}.js</code>:</p>` +
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
        `<p class="submit-note">The ✓ above is a practice check. Your grade comes from the code ` +
        `you actually submit, re-run by your instructor.</p>` +
      `</details>` +
    `</div>`;
  mount.appendChild(wrap);

  const editor = wrap.querySelector(".editor");
  const goalRender = wrap.querySelector(".goal-render");
  const yourRender = wrap.querySelector(".your-render");
  const verdict = wrap.querySelector(".verdict");
  const runBtn = wrap.querySelector(".run-btn");
  const resetBtn = wrap.querySelector(".reset-btn");
  const submission = wrap.querySelector(".submission");
  const copyBtn = wrap.querySelector(".copy-btn");
  const copyNote = wrap.querySelector(".copy-note");

  // Restore saved work; fall back to the starter stub.
  editor.value = localStorage.getItem(storageKey) ?? stub;

  const refreshSubmission = () => { submission.value = buildSubmission(a.id, editor.value); };
  refreshSubmission();

  requestAnimationFrame(() => { autoSize(editor); autoSize(submission); });
  editor.addEventListener("input", () => {
    autoSize(editor);
    localStorage.setItem(storageKey, editor.value);
    refreshSubmission();
    autoSize(submission);
  });
  editor.addEventListener("keydown", handleTab);
  resetBtn.addEventListener("click", () => {
    editor.value = stub;
    localStorage.setItem(storageKey, editor.value);
    autoSize(editor);
    refreshSubmission();
    autoSize(submission);
    editor.focus();
  });

  copyBtn.addEventListener("click", async () => {
    refreshSubmission();
    const ok = await copyText(submission.value);
    copyNote.textContent = ok ? "Copied to clipboard." : "Press Ctrl/Cmd-C to copy the text above.";
    if (!ok) { submission.focus(); submission.select(); }
    setTimeout(() => { copyNote.textContent = ""; }, 4000);
  });

  // Build the goal GIF from the (unsealed, never shown) solution. Passing it as
  // its own reference makes runKarel draw Karel green on the winning end-state.
  try {
    const img = await runKarel(a.world, solutionFn,
      { ...opts, solution: solutionFn, check: aspects, end: a.end });
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
    // Parse once up front for a friendly syntax/main() error before running.
    try {
      compileProgram(editor.value);
    } catch (err) {
      yourRender.innerHTML = `<div class="err">${esc(friendlyError(err))}</div>`;
      runBtn.disabled = false;
      return;
    }
    try {
      // Grade the run against the unsealed solution, exactly like a lesson
      // challenge. When isolate is on the student's (untrusted, maybe infinite)
      // code runs in a Web Worker, passed as source text, so it can't freeze the
      // page; otherwise it runs in-thread.
      const gradeOpts = { ...opts, solution: solutionFn, check: aspects, end: a.end };
      const img = isolate
        ? await runKarelInWorker(a.world, editor.value, gradeOpts)
        : await runKarel(a.world, compileProgram(editor.value), gradeOpts);
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
