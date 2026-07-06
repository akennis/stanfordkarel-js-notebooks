import { runKarel } from "https://esm.sh/stanfordkarel-js-notebooks/stanfordkarel.js";

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

// A canonical, comparable snapshot of the world once a program has finished.
// runKarel() awaits mainFunc before rendering, so by the time it resolves the
// KarelProgram instance we captured holds the final state.
function snapshot(k) {
  const beepers = [...k.world.beepers.entries()]
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${key}=${count}`)
    .sort()
    .join(",");
  return { avenue: k.avenue, street: k.street, direction: k.direction, beepers };
}

// Compare only the aspects a challenge cares about ("beepers", "position",
// "direction"). Defaults let a challenge ignore Karel's final pose when only
// the beeper layout matters, or vice versa.
function statesMatch(reader, goal, aspects) {
  if (!reader || !goal) return false;
  if (aspects.includes("beepers") && reader.beepers !== goal.beepers) return false;
  if (aspects.includes("position") &&
      (reader.avenue !== goal.avenue || reader.street !== goal.street)) return false;
  if (aspects.includes("direction") && reader.direction !== goal.direction) return false;
  return true;
}

// Run a program and return both its animated <img> and its final-state snapshot.
// We wrap mainFunc so we can grab the live KarelProgram reference; the wrapper
// forwards the call (and return value, so async programs are still awaited).
async function runAndCapture(world, fn, opts) {
  let prog = null;
  const wrapped = (k) => { prog = k; return fn(k); };
  const img = await runKarel(world, wrapped, opts);
  return { img, state: prog ? snapshot(prog) : null };
}

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

// Render a list of notebook cells into the mount element. Each cell is one of:
//   { md }                       — a prose/HTML block
//   { world, code, opts }        — a read-only demo. `code` is the entire
//                                   program *source* (a string, e.g. helper
//                                   functions + `function main(k)`). It is shown
//                                   verbatim and compiled/run exactly the way a
//                                   challenge compiles the reader's code.
//   { world, solution, prompt,   — an interactive challenge: the reader writes
//     starter?, check?, opts? }    code and Runs it to match the solution's goal
//                                   GIF. `solution` source is NEVER displayed.
export async function renderNotebook(cells, mount = document.getElementById("notebook")) {
  let counter = 0;
  const nb = mount;

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
    const wrap = document.createElement("div");
    wrap.className = "challenge";
    const aspects = cell.check || ["beepers", "position", "direction"];
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
            `<button type="button" class="reset-btn" title="Restore the starter code">Reset</button>` +
            `<span class="verdict"></span>` +
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

    editor.value = stub;
    // autoSize needs layout; defer until the element is measured in the DOM.
    requestAnimationFrame(() => autoSize(editor));
    editor.addEventListener("input", () => autoSize(editor));
    editor.addEventListener("keydown", handleTab);
    resetBtn.addEventListener("click", () => {
      editor.value = stub;
      autoSize(editor);
      editor.focus();
    });

    // Build the goal GIF and target state from the (never shown) solution.
    let target = null;
    try {
      const { img, state } = await runAndCapture(cell.world, cell.solution, opts);
      target = state;
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
      let fn;
      try {
        fn = compileMain(editor.value);
      } catch (err) {
        yourRender.innerHTML = `<div class="err">${esc(friendlyError(err))}</div>`;
        runBtn.disabled = false;
        return;
      }
      try {
        const { img, state } = await runAndCapture(cell.world, fn, opts);
        yourRender.replaceChildren(img);
        if (img.dataset.error) {
          const e = document.createElement("div");
          e.className = "err";
          e.textContent = "Karel stopped early: " + img.dataset.error;
          yourRender.appendChild(e);
        }
        if (target && statesMatch(state, target, aspects)) {
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
