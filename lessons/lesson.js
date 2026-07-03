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

function bodySource(fn) {
  const s = fn.toString();
  return dedent(s.slice(s.indexOf("{") + 1, s.lastIndexOf("}")));
}

// Render a list of notebook cells into the mount element. Each cell is either
// a markdown block ({ md }) or a runnable Karel cell ({ world, code, opts }).
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
    wrap.innerHTML =
      `<div class="in"><div class="prompt">In [${n}]:</div>` +
      `<pre class="code"><code>${highlight(bodySource(cell.code))}</code></pre></div>` +
      `<div class="out"><div class="prompt out-prompt">Out[${n}]:</div>` +
      `<div class="render"><span class="status">Running…</span></div></div>`;
    nb.appendChild(wrap);
    const render = wrap.querySelector(".render");
    try {
      const img = await runKarel(cell.world, cell.code, cell.opts || { cellSize: 46, delay: 150 });
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

  for (const cell of cells) {
    if (cell.md !== undefined) renderMd(cell);
    else await renderCode(cell);
  }
}
