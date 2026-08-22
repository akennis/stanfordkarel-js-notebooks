/**
 * Site-wide navigation — the single source of truth for page order and the
 * shared navbar. Every HTML page in the repo includes exactly one line:
 *
 *     <script type="module" src="./site-nav.js"></script>     (root pages)
 *     <script type="module" src="../site-nav.js"></script>    (lessons/, assignments/)
 *
 * and gets, with no other markup or stylesheet:
 *
 *   - a sticky navbar: Home · Lessons · Assignments · Reference on the left, Next on the right;
 *   - a bottom prev/next pager, generated from the same data.
 *
 * All links are resolved against this module's own URL (`import.meta.url`), so
 * the same file works from the repo root, from `lessons/`, from `assignments/`,
 * and under a GitHub Pages project base (`/<repo>/`) — no absolute paths.
 *
 * TO ADD OR REORDER A PAGE: edit SECTIONS below. Nothing else in the site
 * encodes page order.
 *
 * Optional per-page overrides, as attributes on the script tag above:
 *   data-prev / data-prev-label   supply a prev link for a page not in SECTIONS
 *   data-next / data-next-label   likewise for next (see also setNext() below,
 *                                 for pages whose next is only known at runtime)
 */

// ─────────────────────────── SITE MAP ───────────────────────────
// Paths are relative to the repo root. "Next" advances within a section only;
// the last page of a section has no Next link (it is omitted, never disabled).
// A page not listed here still gets the navbar — just no Next and no pager.

const SECTIONS = [
  {
    id: "lessons",
    pages: [
      ["index.html", "Home"],
      ["lessons/01-commands.html", "Commands"],
      ["lessons/02-functions.html", "Functions"],
      ["lessons/03-if.html", "if statements"],
      ["lessons/04-for-loops.html", "for loops"],
      ["lessons/05-while-loops.html", "while loops"],
      ["lessons/06-if-else.html", "if / else"],
      ["lessons/07-parameters.html", "Parameters"],
      ["lessons/08-variables.html", "Variables"],
      ["lessons/09-booleans-return.html", "Return values"],
      ["lessons/10-capstone.html", "Capstone"],
      ["lessons/11-numbers-operators.html", "Numbers & Operators"],
      ["lessons/12-strings.html", "Strings"],
      ["lessons/13-arrays.html", "Arrays"],
      ["lessons/14-objects.html", "Objects"],
      ["lessons/15-maps.html", "Maps"],
      ["lessons/16-scope.html", "Scope"],
      ["lessons/17-recursion.html", "Recursion"],
      ["lessons/18-error-handling.html", "Error handling"],
    ],
  },
  {
    id: "assignments",
    pages: [
      ["assignments/index.html", "Assignments"],
    ],
  },
  {
    id: "reference",
    pages: [
      ["lessons/reference.html", "Karel Reference"],
      ["lessons/ref-move.html", "k.move()"],
      ["lessons/ref-turn-left.html", "k.turnLeft()"],
      ["lessons/ref-put-beeper.html", "k.putBeeper()"],
      ["lessons/ref-pick-beeper.html", "k.pickBeeper()"],
      ["lessons/ref-paint-corner.html", "k.paintCorner()"],
      ["lessons/ref-front-is-clear.html", "k.frontIsClear()"],
      ["lessons/ref-left-is-clear.html", "k.leftIsClear()"],
      ["lessons/ref-right-is-clear.html", "k.rightIsClear()"],
      ["lessons/ref-beepers-present.html", "k.beepersPresent()"],
      ["lessons/ref-beepers-in-bag.html", "k.beepersInBag()"],
      ["lessons/ref-facing-north.html", "k.facingNorth()"],
      ["lessons/ref-facing-east.html", "k.facingEast()"],
      ["lessons/ref-facing-south.html", "k.facingSouth()"],
      ["lessons/ref-facing-west.html", "k.facingWest()"],
      ["lessons/ref-corner-color-is.html", "k.cornerColorIs()"],
    ],
  },
  {
    id: "tools",
    pages: [
      ["playground.html", "Playground"],
      ["world-formats.html", "World Formats"],
      ["world-editor.html", "World Editor"],
    ],
  },
];

/**
 * Links shown on the left of the navbar, in order. Exactly one is marked as
 * current, most specific match first: the link pointing at this very page, else
 * the link owning this page's `section`, else — for pages outside the site map,
 * like assignments/assignment.html — the link whose `prefix` the page sits under.
 */
const PRIMARY = [
  { href: "index.html", label: "Home" },
  { href: "index.html#lessons", label: "Lessons", section: "lessons", prefix: "lessons/" },
  { href: "assignments/index.html", label: "Assignments", section: "assignments", prefix: "assignments/" },
  { href: "lessons/reference.html", label: "Reference", section: "reference" },
];

// ─────────────────────────── LOCATION ───────────────────────────

/** Repo-root URL, derived from this module's location (it sits at the root). */
const ROOT = new URL("./", import.meta.url);

/** @returns {string} the current page as a root-relative path, e.g. "lessons/03-if.html". */
function currentPath() {
  const here = decodeURIComponent(location.pathname);
  const root = decodeURIComponent(ROOT.pathname);
  let rel = here.startsWith(root) ? here.slice(root.length) : here.replace(/^\//, "");
  if (rel === "" || rel.endsWith("/")) rel += "index.html";
  return rel;
}

/** @param {string} path root-relative path @returns {string} absolute href */
const url = (path) => new URL(path, ROOT).href;

/** Locate the current page in the site map. @returns {{section:object,i:number}|null} */
function locate(path) {
  for (const section of SECTIONS) {
    const i = section.pages.findIndex(([p]) => p === path);
    if (i !== -1) return { section, i };
  }
  return null;
}

// ─────────────────────────── STYLES ───────────────────────────
// Injected rather than shipped as a .css file so pages with their own inline
// <style> need no extra <link>. Falls back to literal colors on pages that
// don't define the shared custom properties.

const CSS = `
.site-nav{position:sticky;top:0;z-index:100;background:#fff;
  border-bottom:1px solid var(--line,#e5e7eb);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;}
.site-nav-in{max-width:68rem;margin:0 auto;padding:.6rem 1.25rem;
  display:flex;align-items:center;gap:1.25rem;font-size:.92rem;}
.site-nav a{color:var(--muted,#666);text-decoration:none;font-weight:500;
  white-space:nowrap;}
.site-nav a:hover{color:var(--accent,#0b5fff);}
.site-nav a[aria-current]{color:var(--ink,#1a1a1a);font-weight:600;}
.site-nav .site-nav-sp{flex:1;}
.site-nav a.site-next{color:var(--accent,#0b5fff);font-weight:600;
  overflow:hidden;text-overflow:ellipsis;}
.site-pager{max-width:52rem;margin:2rem auto 3rem;padding:1.2rem 1.25rem 0;
  border-top:1px solid var(--line,#e5e7eb);display:flex;gap:1rem;font-size:.95rem;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;}
.site-pager a{color:var(--accent,#0b5fff);text-decoration:none;font-weight:500;}
.site-pager a:hover{text-decoration:underline;}
.site-pager .site-pager-sp{flex:1;}
/* keep in-page anchors clear of the sticky bar */
:target{scroll-margin-top:4rem;}
@media (max-width:520px){
  .site-nav-in{gap:.9rem;padding:.55rem .9rem;font-size:.86rem;}
}
`;

// ─────────────────────────── RENDER ───────────────────────────

const script = document.querySelector('script[src$="site-nav.js"]');
const data = script ? script.dataset : {};

const here = currentPath();
const found = locate(here);

const prev = found && found.i > 0 ? found.section.pages[found.i - 1] : null;
const next = found && found.i < found.section.pages.length - 1
  ? found.section.pages[found.i + 1]
  : null;

function anchor(href, label, className) {
  const a = document.createElement("a");
  a.href = href;
  a.textContent = label;
  if (className) a.className = className;
  return a;
}

/** Index into PRIMARY of the link to mark current, or -1. */
function currentPrimary() {
  const exact = PRIMARY.findIndex((l) => l.href.split("#")[0] === here);
  if (exact !== -1) return exact;
  if (found) return PRIMARY.findIndex((l) => l.section === found.section.id);
  return PRIMARY.findIndex((l) => l.prefix && here.startsWith(l.prefix));
}

/** Build the navbar. Next is appended only when there is somewhere to go. */
function buildNav() {
  const nav = document.createElement("nav");
  nav.className = "site-nav";
  nav.setAttribute("aria-label", "Site");
  const inner = document.createElement("div");
  inner.className = "site-nav-in";

  const current = currentPrimary();
  PRIMARY.forEach((link, i) => {
    const a = anchor(url(link.href), link.label);
    if (i === current) a.setAttribute("aria-current", "true");
    inner.append(a);
  });

  const spacer = document.createElement("span");
  spacer.className = "site-nav-sp";
  inner.append(spacer);
  nav.append(inner);
  return { nav, inner };
}

const { nav, inner: navInner } = buildNav();

/** Build the bottom pager, or null when the page has neither neighbour. */
function buildPager(prevLink, nextLink) {
  if (!prevLink && !nextLink) return null;
  const pager = document.createElement("nav");
  pager.className = "site-pager";
  pager.setAttribute("aria-label", "Pagination");
  if (prevLink) pager.append(anchor(prevLink.href, `← ${prevLink.label}`));
  const spacer = document.createElement("span");
  spacer.className = "site-pager-sp";
  pager.append(spacer);
  if (nextLink) pager.append(anchor(nextLink.href, `${nextLink.label} →`));
  return pager;
}

const prevLink = prev
  ? { href: url(prev[0]), label: prev[1] }
  : data.prev
    ? { href: new URL(data.prev, location.href).href, label: data.prevLabel || "Back" }
    : null;

let nextLink = next
  ? { href: url(next[0]), label: next[1] }
  : data.next
    ? { href: new URL(data.next, location.href).href, label: data.nextLabel || "Next" }
    : null;

const style = document.createElement("style");
style.textContent = CSS;
document.head.append(style);

let navNext = null;
let pager = buildPager(prevLink, nextLink);

function paintNext() {
  if (navNext) navNext.remove();
  navNext = null;
  if (!nextLink) return;
  navNext = anchor(nextLink.href, `${nextLink.label} →`, "site-next");
  navNext.setAttribute("rel", "next");
  navInner.append(navNext);
}

paintNext();
document.body.prepend(nav);
if (pager) document.body.append(pager);

/**
 * Set the Next link at runtime, for pages whose successor isn't static —
 * e.g. assignments/assignment.html, whose next depends on `?id=`.
 * Pass no href (or a falsy one) to remove the Next link entirely.
 *
 * @param {string|null} href  URL, resolved against the current page
 * @param {string} [label]    link text, shown as "label →"
 * @returns {void}
 */
export function setNext(href, label = "Next") {
  nextLink = href ? { href: new URL(href, location.href).href, label } : null;
  paintNext();
  const rebuilt = buildPager(prevLink, nextLink);
  if (pager) pager.remove();
  pager = rebuilt;
  if (pager) document.body.append(pager);
}

/** The site map, exported so tooling can verify or reuse the page order. */
export { SECTIONS };
