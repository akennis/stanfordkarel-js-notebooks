/**
 * code-backup.js — the safety net behind the destructive Reset button.
 *
 * Reset erases a student's editor (and, on an assignment, the saved work in
 * localStorage) and tells them so: "this cannot be undone." That warning is
 * deliberate — it is what keeps Reset from being clicked idly — but the work is
 * not actually thrown away. Every confirmed Reset first copies the code into a
 * separate backup slot that only a teacher is expected to know about, so lost
 * work can be recovered at the student's machine.
 *
 * Storage layout (one key per editor, holding a short history so three resets
 * in a row can't bury the good version under copies of the starter stub):
 *
 *     karel-backup:assignment:<assignmentId>:<problemKey>  →  [{ts, code, …}, …]
 *     karel-backup:lesson:<pageSlug>:<challengeIndex>      →  [{ts, code, …}, …]
 *
 * Entries are oldest-first, capped at BACKUP_CAP. The live keys the pages
 * normally save to (`karel-assignment:…`) are untouched by this module.
 *
 * RECOVERY (teacher): everything here is per-origin browser storage that never
 * leaves the device, so you must be on the student's machine, browser profile
 * and site origin. Then either
 *
 *   - add ?recover=1 to the page URL for a panel listing every backup, or
 *   - open the console and use `karelBackups`:
 *         karelBackups.list()                  every slot on this origin
 *         karelBackups.dump("assignment:lesson-04:simple")   full source
 *         karelBackups.restore("assignment:lesson-04:simple")
 *         karelBackups.panel()                 opens the panel without the URL
 *
 * Restoring writes back into whichever editor on the current page owns that
 * slot, so open the page the work came from (each entry records its page).
 */

const PREFIX = "karel-backup:";
const BACKUP_CAP = 5;

// Editors on the current page, by scope: what restore() writes back into.
const slots = new Map();

const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

/** The page slug used to scope lesson challenges (e.g. "04-for-loops"). */
export function pageSlug() {
  const file = location.pathname.split("/").pop() || "index";
  return file.replace(/\.html?$/i, "") || "index";
}

/**
 * Register the editor that owns `scope`, so a recovered backup has somewhere to
 * go. `save(code)` should do whatever the page normally does after an edit
 * (persist it, resize the textarea, refresh a submission box).
 * @param {string} scope   e.g. "assignment:lesson-04:simple"
 * @param {{label:string, editor:HTMLTextAreaElement, save:(code:string)=>void}} slot
 */
export function registerSlot(scope, { label, editor, save }) {
  slots.set(scope, { label, editor, save });
  // Cards render asynchronously; if the panel is already open, fold in the
  // slot that just appeared so its Restore button isn't stuck disabled.
  if (panelEl && !panelEl.hidden) renderPanelBody(panelEl.querySelector(".karel-recover-body"));
}

/** All backup entries for one scope, oldest first. Never throws. */
export function readBackups(scope) {
  try {
    const raw = localStorage.getItem(PREFIX + scope);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

/**
 * Copy `code` into the backup slot for `scope`. Called immediately before a
 * confirmed Reset wipes the editor. Skips empty code, the untouched starter
 * stub, and anything identical to the newest entry, so the history holds real
 * work rather than stub noise. Storage failures (private mode, quota) are
 * swallowed — a backup must never break Reset itself.
 * @param {string} scope
 * @param {string} code
 * @param {{stub?:string, label?:string}} [meta]
 */
export function backupCode(scope, code, { stub = null, label = "" } = {}) {
  if (!code || !code.trim()) return;
  if (stub != null && code === stub) return;
  const list = readBackups(scope);
  if (list.length && list[list.length - 1].code === code) return;

  list.push({ ts: Date.now(), code, label, page: location.pathname + location.search });
  while (list.length > BACKUP_CAP) list.shift();

  const write = () => localStorage.setItem(PREFIX + scope, JSON.stringify(list));
  try {
    write();
  } catch {
    // Most likely the 5MB quota. Drop the oldest entry and try once more.
    list.shift();
    try { write(); } catch { /* private mode or still full: give up quietly */ }
  }
}

/** Every backup slot on this origin: `{ scope, versions, newest, label, page, restorable }`. */
export function listBackups() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(PREFIX)) continue;
    const scope = key.slice(PREFIX.length);
    const list = readBackups(scope);
    if (!list.length) continue;
    const newest = list[list.length - 1];
    out.push({
      scope,
      versions: list.length,
      newest: new Date(newest.ts).toLocaleString(),
      label: newest.label || scope,
      page: newest.page || "",
      restorable: slots.has(scope),
    });
  }
  return out.sort((a, b) => a.scope.localeCompare(b.scope));
}

/**
 * Put a backed-up version back into its editor.
 * @param {string} scope
 * @param {number} [index]  position in the history, 0 = oldest; negative counts
 *                          back from the newest (the default, -1).
 * @returns {boolean} false if there is no such backup or the editor isn't on this page.
 */
export function restoreBackup(scope, index = -1) {
  const list = readBackups(scope);
  const entry = list.at(index);
  if (!entry) {
    console.warn(`[karelBackups] no backup at index ${index} for "${scope}".`);
    return false;
  }
  const slot = slots.get(scope);
  if (!slot) {
    console.warn(`[karelBackups] "${scope}" isn't on this page — open ${entry.page || "its page"} and try again. ` +
      `Its code is printed by karelBackups.dump("${scope}").`);
    return false;
  }
  slot.editor.value = entry.code;
  slot.save(entry.code);
  slot.editor.focus();
  return true;
}

/** Print every version of one scope (or of all scopes) to the console. */
export function dumpBackups(scope = null) {
  const scopes = scope ? [scope] : listBackups().map(b => b.scope);
  if (!scopes.length) { console.log("[karelBackups] nothing backed up on this origin."); return; }
  for (const s of scopes) {
    const list = readBackups(s);
    console.group(`${s} — ${list.length} version(s)`);
    list.forEach((e, i) => {
      console.log(`[${i}] ${new Date(e.ts).toLocaleString()}${e.page ? "  ·  " + e.page : ""}\n${e.code}`);
    });
    console.groupEnd();
  }
}

// ─────────────────────────── RECOVERY PANEL ───────────────────────────
// Shown on ?recover=1 (or #recover), or on demand via karelBackups.panel().
// Styles are injected so no page needs an extra stylesheet link.

const CSS = `
.karel-recover{position:fixed;right:1rem;bottom:1rem;z-index:200;width:min(34rem,calc(100vw - 2rem));
  max-height:min(32rem,calc(100vh - 2rem));overflow:auto;background:#fff;
  border:1px solid var(--in-border,#d0d7de);border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.18);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;
  font-size:.86rem;color:var(--ink,#1a1a1a);}
.karel-recover-head{display:flex;align-items:baseline;gap:.5rem;padding:.7rem .9rem;
  border-bottom:1px solid var(--line,#e5e7eb);background:#f6f8fa;border-radius:10px 10px 0 0;
  position:sticky;top:0;}
.karel-recover-head strong{font-size:.92rem;}
.karel-recover-head .sp{flex:1;}
.karel-recover-close{font:inherit;font-size:1.1rem;line-height:1;color:var(--muted,#666);
  background:none;border:none;cursor:pointer;padding:0 .2rem;}
.karel-recover-body{padding:.7rem .9rem 1rem;}
.karel-recover-note{margin:0 0 .7rem;color:var(--muted,#666);font-size:.8rem;line-height:1.5;}
.karel-recover-slot{border:1px solid var(--line,#e5e7eb);border-radius:8px;margin:.55rem 0;overflow:hidden;}
.karel-recover-slot > h4{margin:0;padding:.45rem .65rem;background:#fafbfc;font-size:.84rem;
  border-bottom:1px solid var(--line,#e5e7eb);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}
.karel-recover-ver{display:flex;align-items:center;gap:.45rem;flex-wrap:wrap;padding:.4rem .65rem;
  border-top:1px solid #f1f3f5;}
.karel-recover-ver:first-of-type{border-top:none;}
.karel-recover-ver time{color:var(--muted,#666);font-size:.8rem;flex:1 1 9rem;}
.karel-recover-ver button{font:inherit;font-size:.78rem;border-radius:5px;padding:.22rem .55rem;
  cursor:pointer;background:#fff;border:1px solid var(--in-border,#d0d7de);color:var(--ink,#1a1a1a);}
.karel-recover-ver button.primary{background:var(--accent,#0b5fff);border-color:var(--accent,#0b5fff);color:#fff;font-weight:600;}
.karel-recover-ver button:disabled{opacity:.5;cursor:default;}
.karel-recover-ver details{flex:1 1 100%;}
.karel-recover-ver summary{cursor:pointer;color:var(--accent,#0b5fff);font-size:.78rem;}
.karel-recover-ver pre{margin:.35rem 0 0;padding:.5rem .6rem;background:var(--in-bg,#f6f8fa);
  border:1px solid var(--in-border,#d0d7de);border-radius:6px;overflow-x:auto;
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.78rem;line-height:1.5;
  white-space:pre;}
.karel-recover-hint{color:var(--muted,#666);font-size:.78rem;flex:1 1 100%;}
.karel-recover-empty{color:var(--muted,#666);font-style:italic;}
`;

let panelEl = null;
let cssEl = null;

function ensureCSS() {
  if (cssEl) return;
  cssEl = document.createElement("style");
  cssEl.textContent = CSS;
  document.head.append(cssEl);
}

function renderPanelBody(body) {
  const backups = listBackups();
  if (!backups.length) {
    body.innerHTML = `<p class="karel-recover-empty">No backups on this origin. ` +
      `Backups are written only when a student confirms Reset, and never leave this browser profile.</p>`;
    return;
  }
  body.innerHTML =
    `<p class="karel-recover-note">One entry per confirmed Reset, newest first, ` +
    `${BACKUP_CAP} kept per editor. Restore puts the code back in its editor on this page; ` +
    `slots from another page show their source instead — open that page to restore there.</p>` +
    backups.map(b => {
      const list = readBackups(b.scope);
      const rows = list.map((e, i) => i).reverse().map(i => {
        const e = list[i];
        return `<div class="karel-recover-ver">` +
          `<time>${esc(new Date(e.ts).toLocaleString())}</time>` +
          `<button type="button" class="primary" data-restore="${esc(b.scope)}" data-index="${i}"` +
            `${b.restorable ? "" : " disabled"}>Restore</button>` +
          `<button type="button" data-copy="${esc(b.scope)}" data-index="${i}">Copy</button>` +
          `<details><summary>View code</summary><pre>${esc(e.code)}</pre></details>` +
          (b.restorable ? "" : `<span class="karel-recover-hint">Not on this page — from ${esc(e.page || "another page")}</span>`) +
        `</div>`;
      }).join("");
      return `<div class="karel-recover-slot"><h4>${esc(b.label)} <span style="opacity:.6">(${esc(b.scope)})</span></h4>${rows}</div>`;
    }).join("");
}

/** Open (or refresh) the recovery panel. */
export function openRecoveryPanel() {
  ensureCSS();
  if (!panelEl) {
    panelEl = document.createElement("div");
    panelEl.className = "karel-recover";
    panelEl.setAttribute("role", "dialog");
    panelEl.setAttribute("aria-label", "Recover erased code");
    panelEl.innerHTML =
      `<div class="karel-recover-head"><strong>Recover erased code</strong>` +
      `<span class="sp"></span>` +
      `<button type="button" class="karel-recover-close" aria-label="Close">×</button></div>` +
      `<div class="karel-recover-body"></div>`;
    document.body.append(panelEl);
    panelEl.querySelector(".karel-recover-close").addEventListener("click", closeRecoveryPanel);
    panelEl.addEventListener("click", async e => {
      const btn = e.target.closest("button[data-restore],button[data-copy]");
      if (!btn) return;
      const index = Number(btn.dataset.index);
      if (btn.dataset.restore) {
        if (restoreBackup(btn.dataset.restore, index)) btn.textContent = "Restored ✓";
        return;
      }
      const entry = readBackups(btn.dataset.copy)[index];
      if (!entry) return;
      try {
        await navigator.clipboard.writeText(entry.code);
        btn.textContent = "Copied ✓";
      } catch {
        btn.textContent = "Use View code";
      }
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeRecoveryPanel(); });
  }
  renderPanelBody(panelEl.querySelector(".karel-recover-body"));
  panelEl.hidden = false;
}

/** Hide the recovery panel. */
export function closeRecoveryPanel() {
  if (panelEl) panelEl.hidden = true;
}

/**
 * Expose the console helpers on `window.karelBackups` and auto-open the panel
 * when the URL carries ?recover=1 or #recover. Call once per page.
 */
export function installRecoveryTools() {
  if (window.karelBackups) return;
  window.karelBackups = {
    list: () => { const b = listBackups(); console.table(b); return b; },
    dump: dumpBackups,
    read: readBackups,
    restore: restoreBackup,
    panel: openRecoveryPanel,
  };
  const wanted = new URLSearchParams(location.search).get("recover");
  if (wanted === "1" || wanted === "true" || location.hash === "#recover") {
    // Defer so the page's editors have registered their slots first.
    requestAnimationFrame(() => openRecoveryPanel());
  }
}
