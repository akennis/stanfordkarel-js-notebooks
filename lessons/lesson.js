import { runKarel, runKarelInWorker } from "../stanfordkarel.js";
import { backupCode, registerSlot, installRecoveryTools, pageSlug } from "../code-backup.js";

const esc = s => s.replace(/[&<>]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;" }[c]));

function highlight(src) {
  return src.split(/(\/\/[^\n]*|`[^`]*`|"[^"]*"|'[^']*')/g).map((p, i) => {
    if (i % 2 === 1) return `<span class="${p.startsWith("//") ? "cm" : "st"}">${esc(p)}</span>`;
    let h = esc(p);
    h = h.replace(/\b(function|for|while|if|else|let|const|return|true|false|new)\b/g, '<span class="kw">$1</span>');
    h = h.replace(/\b(\d+)\b/g, '<span class="nm">$1</span>');
    return h;
  }).join("");
}

function dedent(s) {
  const lines = s.replace(/^\n+/, "").replace(/\s+$/, "").split("\n");
  const widths = lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length);
  const min = widths.length ? Math.min(...widths) : 0;
  return lines.map(l => l.slice(min)).join("\n");
}

// ─────────────────────────── CHALLENGE SUPPORT ──────────────────────────────
// Shared machinery for interactive "write code, hit Run, match the goal" cells.
// Kept generic so any lesson can drop in a challenge cell (see renderNotebook).

const DEFAULT_OPTS = { cellSize: 46, delay: 150 };
const DEFAULT_STUB = "function main(k) {\n  // your code here\n}\n";

// Turn the reader's editor text into a callable main(). new Function throws a
// SyntaxError up front for malformed code, which the caller reports.
function compileMain(src) {
  const factory = new Function(`"use strict";\n${src}\n;return typeof main === "function" ? main : null;`);
  const fn = factory();
  if (typeof fn !== "function")
    throw new ReferenceError("Your code must define a function called main, e.g. function main(k) { … }");
  return fn;
}

function friendlyError(err) {
  if (err instanceof ReferenceError && /\bmain\b/.test(err.message)) return err.message;
  if (err instanceof SyntaxError) return "Syntax error: " + err.message;
  return err.message;
}

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

// Render a list of notebook cells into the mount element. Each cell is one of:
//   { md }                       — a prose/HTML block
//   { world, code, opts }        — a read-only demo. `code` is the entire
//                                   program *source* (a string, e.g. helper
//                                   functions + `function main(k)`). It is shown
//                                   verbatim and compiled/run exactly the way a
//                                   challenge compiles the reader's code.
//   { world, solution, prompt,   — an interactive challenge: the reader writes
//     starter?, check?, end?,       code and Runs it to match the solution's
//     opts? }                       goal GIF. `solution` source is NEVER shown.
//                                   `end` optionally pins the required final
//                                   pose ({ avenue, street, direction }).
//
// Options (third arg):
//   { isolate }  — when true, the reader's challenge code runs in a Web Worker
//                  via runKarelInWorker, so an infinite loop can't freeze the
//                  page. Grading (the green ✓) is unchanged. Read-only demo and
//                  goal cells still run in-thread (their code is trusted).
export async function renderNotebook(cells, mount = document.getElementById("notebook"), { isolate = false } = {}) {
  let counter = 0;
  let challengeCount = 0;
  const nb = mount;
  // Teacher-side recovery for code erased by Reset (see ../code-backup.js).
  installRecoveryTools();

  function renderMd(cell) {
    const div = document.createElement("div");
    div.className = "md";
    div.innerHTML = cell.md;
    nb.appendChild(div);
  }

  async function renderCode(cell) {
    const n = ++counter;
    const wrap = document.createElement("div");
    wrap.className = "cell";
    const src = dedent(cell.code);
    wrap.innerHTML =
      `<div class="in"><div class="prompt">In [${n}]:</div>` +
      `<pre class="code"><code>${highlight(src)}</code></pre></div>` +
      `<div class="out"><div class="prompt out-prompt">Out[${n}]:</div>` +
      `<div class="render"><span class="status">Running…</span></div></div>`;
    nb.appendChild(wrap);
    const render = wrap.querySelector(".render");
    // Compile the displayed source into main() the same way challenges do, so
    // what the learner sees is exactly what runs — no wrapper is fabricated here.
    let main;
    try {
      main = compileMain(src);
    } catch (err) {
      render.innerHTML = `<div class="err">Error: ${esc(friendlyError(err))}</div>`;
      return;
    }
    try {
      const img = await runKarel(cell.world, main, cell.opts || DEFAULT_OPTS);
      render.replaceChildren(img);
      if (img.dataset.error) {
        const e = document.createElement("div");
        e.className = "err";
        e.textContent = "Karel stopped early: " + img.dataset.error;
        render.appendChild(e);
      }
    } catch (err) {
      render.innerHTML = `<div class="err">Error: ${esc(err.message)}</div>`;
    }
  }

  async function renderChallenge(cell) {
    // Captured per card: challengeCount keeps climbing as later cells render.
    const n = ++challengeCount;
    const scope = `lesson:${pageSlug()}:${n}`;
    const label = `${pageSlug()} · challenge ${n}`;
    const wrap = document.createElement("div");
    wrap.className = "challenge";
    const aspects = cell.check || ["beepers", "position", "direction", "colors"];
    const opts = cell.opts || DEFAULT_OPTS;
    wrap.innerHTML =
      `<div class="chal-head"><span class="chal-badge">Challenge</span>` +
      `<div class="chal-prompt">${cell.prompt || ""}</div></div>` +
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
            `<button type="button" class="reset-btn" title="Restore the starter code" aria-expanded="false">Reset</button>` +
            `<span class="verdict"></span>` +
          `</div>` +
          `<div class="reset-confirm" role="alertdialog" aria-modal="false" hidden>` +
            `<p class="reset-warn"><strong>⚠ This will erase your code.</strong> ` +
            `Resetting replaces everything in the editor with the starter code. This cannot be undone.</p>` +
            `<div class="reset-actions">` +
              `<button type="button" class="reset-yes">Erase my code</button>` +
              `<button type="button" class="reset-no">Cancel</button>` +
            `</div>` +
          `</div>` +
          `<div class="panel-label your-label">Your result</div>` +
          `<div class="render your-render"><span class="status muted">Run your code to see Karel go.</span></div>` +
        `</section>` +
      `</div>`;
    nb.appendChild(wrap);

    const stub = cell.starter != null ? dedent(cell.starter) + "\n" : DEFAULT_STUB;
    const editor = wrap.querySelector(".editor");
    const goalRender = wrap.querySelector(".goal-render");
    const yourRender = wrap.querySelector(".your-render");
    const verdict = wrap.querySelector(".verdict");
    const runBtn = wrap.querySelector(".run-btn");
    const resetBtn = wrap.querySelector(".reset-btn");
    const resetConfirm = wrap.querySelector(".reset-confirm");

    editor.value = stub;
    registerSlot(scope, {
      label,
      editor,
      save: () => autoSize(editor),
    });
    // autoSize needs layout; defer until the element is measured in the DOM.
    requestAnimationFrame(() => autoSize(editor));
    editor.addEventListener("input", () => autoSize(editor));
    editor.addEventListener("keydown", handleEditorKeys);
    // Reset is destructive, so it only arms the inline warning; the actual
    // erase happens on the confirm button below it.
    const closeResetConfirm = () => {
      resetConfirm.hidden = true;
      resetBtn.setAttribute("aria-expanded", "false");
    };
    resetBtn.addEventListener("click", () => {
      if (resetConfirm.hidden) {
        resetConfirm.hidden = false;
        resetBtn.setAttribute("aria-expanded", "true");
        wrap.querySelector(".reset-no").focus();
      } else {
        closeResetConfirm();
      }
    });
    wrap.querySelector(".reset-no").addEventListener("click", () => {
      closeResetConfirm();
      editor.focus();
    });
    wrap.querySelector(".reset-yes").addEventListener("click", () => {
      closeResetConfirm();
      // Erased for the student, kept for the teacher — see ../code-backup.js.
      backupCode(scope, editor.value, { stub, label });
      editor.value = stub;
      autoSize(editor);
      editor.focus();
    });

    // Build the goal GIF from the (never shown) solution. Passing the solution
    // as its own reference makes runKarel draw Karel green on the final frame,
    // so the goal shows the winning end-state the reader is aiming for.
    try {
      const img = await runKarel(cell.world, cell.solution,
        { ...opts, solution: cell.solution, check: aspects, end: cell.end });
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
      // Compile once up front as a cheap validity check — this only *parses* the
      // code (it never runs it, so a loop here is harmless) and yields a friendly
      // message for syntax errors or a missing main() before we bother running.
      let fn;
      try {
        fn = compileMain(editor.value);
      } catch (err) {
        yourRender.innerHTML = `<div class="err">${esc(friendlyError(err))}</div>`;
        runBtn.disabled = false;
        return;
      }
      try {
        // Grade the run: the library runs the (never shown) solution, compares
        // final states, enforces any explicit end pose, and reports the result on
        // img.dataset.solved. When isolate is on, the reader's (untrusted, maybe
        // infinite) code runs in a Web Worker — passed as source text — so it
        // can't freeze the page; otherwise it runs in-thread from the compiled fn.
        const gradeOpts = { ...opts, solution: cell.solution, check: aspects, end: cell.end };
        const img = isolate
          ? await runKarelInWorker(cell.world, editor.value, gradeOpts)
          : await runKarel(cell.world, fn, gradeOpts);
        yourRender.replaceChildren(img);
        if (img.dataset.error) {
          const e = document.createElement("div");
          e.className = "err";
          e.textContent = "Karel stopped early: " + img.dataset.error;
          yourRender.appendChild(e);
        }
        if (img.dataset.solved === "true") {
          verdict.className = "verdict ok";
          verdict.textContent = "✓ Solved — matches the goal!";
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

  for (const cell of cells) {
    if (cell.md !== undefined) renderMd(cell);
    else if (cell.solution !== undefined) await renderChallenge(cell);
    else await renderCode(cell);
  }
}
