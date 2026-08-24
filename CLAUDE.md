# CLAUDE.md

Guidance for working in this repo. Read this before editing; it captures conventions that aren't obvious from any single file.

## What this is

A browser-native JavaScript port of Stanford Karel (CS 106A). It ships two things:

1. **The library** — `stanfordkarel.js`, a single self-contained ES module that parses a world, simulates a Karel program, and renders the run as an animated GIF. Returns an `<img>`.
2. **The course** — `index.html` + `lessons/`, a ten-lesson "Learning JavaScript with Karel" tutorial. Static HTML pages served from GitHub Pages (repo root as base). `lessons/lesson.js` imports the library with a **relative path** (`../stanfordkarel.js`) so the course runs against the repo's own source both under `npx serve .` and on Pages — no CDN version-staleness. Relative (not root-absolute) is required: a project Pages site lives under `/<repo>/`.

There is **no build step, no bundler, no transpile, and no test suite.** Source runs as-is in the browser and Node ≥ ES2020. Do not introduce a build pipeline, TypeScript, or a framework unless explicitly asked — the zero-tooling, single-file design is a deliberate feature (it must import cleanly from a raw CDN URL in Observable and plain HTML).

## Layout

| Path | Purpose |
|---|---|
| `stanfordkarel.js` | The entire library: world parser, simulator (`KarelWorld`, `KarelProgram`), canvas renderer, GIF encoder, `runKarel`, `fetchWorld`. |
| `worlds/` | Bundled world modules. `square.js` etc. each `export default` a world string; `index.js` re-exports them all. |
| `index.html` | Course landing page / table of contents. |
| `site-nav.js` | Site-wide navbar + bottom pager, and the `SECTIONS` site map that is the **single source of truth for page order**. Every HTML page includes it with one line. |
| `code-backup.js` | Teacher-side safety net behind the Reset button: every confirmed Reset copies the student's code to a `karel-backup:` localStorage slot. Imported by both `lessons/lesson.js` and `assignments/assignment.js`. Repo-only, not published. |
| `lessons/` | `01-…10-*.html` lessons, `lesson.js` (`renderNotebook` helper), `lesson.css`, and `square.html` (standalone demo). |
| `assignments/` | Graded coursework. Manifest modules (`<id>.js`) + `index.js` (re-export & lookup), the generic student page `assignment.html` (reads `?id=`), its renderer `assignment.js`, and `index.html` (assignment list). |
| `tools/` | `grade.js` (teacher batch grader) + `grade-worker.js`, `seal.js` (solution sealer), `gen-lesson-assignments.js` (generates the per-lesson assignments), `roster.example.json`. |
| `student-template/` | Starter repo layout students copy to submit (`README.md`, `student.json`, `submissions/`). Repo-only, not published. |
| `package.json` | Published to npm (`files` field): `stanfordkarel.js`, `worlds/`, `assignments/`, `tools/`, `LICENSE`, `README.md`. The course pages (`index.html`, `lessons/`, `student-template/`) are repo-only, served as static files. |

## Architecture of `stanfordkarel.js`

The file is organized in labeled sections (search for `─── SECTION ───` banners): worlds re-export, color constants, `KarelWorld`, direction maps, `KarelProgram`, rendering constants, canvas drawing, `runKarel`, `fetchWorld`.

Key mechanics to preserve when editing:

- **Frame capture is driven by a callback list.** Every mutating Karel action (`move`, `turnLeft`, `putBeeper`, `pickBeeper`, `paintCorner`) calls `this._notify()`, which invokes every function in `this._callbacks`. `runKarel` pushes a `capture()` callback that snapshots a canvas frame. **This is how the animation is built** — one GIF frame per action, plus an initial frame. If you add a new action, it must call `_notify()` or it won't animate.
- **Errors are soft.** `runKarel` wraps `mainFunc` in try/catch. A thrown error (e.g. Karel hitting a wall) does not reject the promise — the partial animation still renders, a final frame draws Karel in red at the offending corner (`renderFrame`'s `errorMark` flag, threaded as the `outline` color through `drawKarelIcon`), and the message is attached to `img.dataset.error` and `img.title`. Preserve this behavior; lessons rely on it to show mistakes.
- **`mainFunc` may be sync or async**, and `runKarel` calls it as `mainFunc(karel)` — passing the `KarelProgram` instance. Both `function main(k) { k.move(); }` and the destructured `function main({ move, turnLeft }) { move(); }` forms work.
- **Public methods are bound to the instance in the constructor** (a loop over `KarelProgram.prototype` binds every non-`_` method). This is what makes the destructured, prefix-free form work — detached calls would otherwise lose `this`. If you add a public method it's bound automatically; if you rename this binding loop or prefix a public method with `_`, the destructure form breaks, so verify it.
- **Direction maps** (`TURN_LEFT_MAP`, `TURN_RIGHT_MAP`, `OPPOSITE_MAP`, `DELTA_MAP`) are the single source of truth for orientation math. Reuse them; don't hand-roll direction logic.

## Coordinate system (get this right)

- **Avenues** = columns / x-axis, run north–south. **Streets** = rows / y-axis, run east–west.
- **1-indexed** from the **south-west** corner. `Karel: (1, 1)` is bottom-left.
- Canvas y is flipped relative to street numbers — higher street = higher on screen. The renderer handles this via `cornerY = topY + cellSize/2 + (numStreets - s) * cellSize`. Match that convention for any new drawing.
- Directions are lowercase strings: `north`, `south`, `east`, `west`.

## World file format

Plain-text, one directive per line, matching the Python `.w` format. Parser is `KarelWorld.loadFromText`.

```
Dimension: (avenues, streets)
Karel: (avenue, street); direction
BeeperBag: n            (or INFINITY)
Beeper: (avenue, street); count
Wall: (avenue, street); direction
Color: (avenue, street); colorName
Speed: n                (float; delay = round(100 / n) ms)
```

Colors are the named constants (e.g. `"Red"`), not CSS/hex — `CSS_COLORS` maps names to render colors.

## Conventions for codegen

- **Match the surrounding style:** 2-space indent, ES modules, `const`/`let`, no semicolintrivia — the file uses semicolons and JSDoc on public functions. Keep exported functions documented with JSDoc `@param`/`@returns`.
- **Keep it single-file and dependency-light.** The only runtime dependency is `gif.js`, loaded lazily inside `runKarel` (`loadGifDeps`). Don't add npm deps for things achievable with the DOM/Canvas API.
- **Don't hardcode CDN version numbers** in library source beyond what's already there; when you must reference a version, prefer the unversioned `esm.sh/stanfordkarel-js-notebooks/...` form. The README pins examples to the current `package.json` version — update those together. The lesson pages are the exception to CDN imports entirely: they load `../stanfordkarel.js` relatively (see above), not from esm.sh.
- When changing the public API (`runKarel` options, Karel methods, color constants, world directives), **update `README.md` in the same change** — its API tables are meant to stay authoritative.

## Adding a world

1. Create `worlds/<name>.js`: `export const <name> = \`...world text...\`;` and `export default <name>;`. Mirror the JSDoc header style of `square.js`.
2. Re-export it from `worlds/index.js`.
3. It's automatically published (the `worlds/` glob is in `files`) and reachable as `karel.worlds.<name>`.
4. Add a row to the "Bundled Worlds" table in `README.md`.

## Adding / editing a lesson

Lessons are static HTML using `renderNotebook(cells)` from `lessons/lesson.js`. A cell is one of three shapes:

- `{ md }` — HTML prose (raw `innerHTML`). Code snippets shown here are hand-written `<pre class="code">…</pre>`; they are **not** run and get no syntax highlighting.
- `{ world, code, opts? }` — a read-only demo. `code` is the **entire program as a source string** (helper functions, if any, followed by `function main(k) { … }`). It is shown verbatim (`dedent` + `highlight`) and compiled with `new Function` the exact same way a challenge compiles the reader's code — so what's displayed is what runs; `lesson.js` never fabricates the `main` wrapper. Conventions: **write the program flush-left** (helpers and `main` at column 0, 2-space body indent); **never nest helper functions inside `main`** — define them as siblings and pass the robot in as a parameter (`function turnRight(k) { … }`, called as `turnRight(k)`). Keep it clean and readable — the learner sees it verbatim.
- `{ world, solution, prompt, check?, starter?, opts? }` — an **interactive challenge**. The reader types into an editor and presses ▶ Run; their code is compiled with `new Function` and run against `world`. `solution` is a `function main(k) {...}` used only to (a) render the green-outlined **goal GIF** and (b) compute the target end-state — its **source is never shown**. Grading compares the reader's final world state to the solution's via the aspects in `check` (default `["beepers","position","direction","colors"]`, where `"colors"` compares painted corner colors; e.g. `["position"]` ignores beepers, final facing, and paint). `prompt` is the task HTML (may embed a `<pre class="code">` block, e.g. a program to retype). `starter` seeds the editor and overrides the default `function main(k) { … }` stub — pass `""` for an empty editor. State capture is library-change-free: `runKarel` awaits `mainFunc` before rendering, so a wrapper grabs the live `KarelProgram` and snapshots `.world.beepers` + Karel's pose.

`opts` (any cell) defaults to `{ cellSize: 46, delay: 150 }`. Cells render top-to-bottom; `md` are synchronous, `code`/`challenge` are awaited so animations build in order.

New lessons: copy an existing `NN-*.html`, add the page to `SECTIONS` in `site-nav.js` (this is what wires up its navbar Next and its bottom pager — never hand-write nav links), and add an entry to the `<ol class="toc">` in `index.html`. The challenge machinery lives entirely in `lesson.js`/`lesson.css`, so any lesson can add challenge cells.

## Site navigation

Every HTML page in the repo — lessons, reference, assignments, playground, world editor, world formats — carries one line before `</body>`:

```html
<script type="module" src="./site-nav.js"></script>    <!-- ../site-nav.js from a subdirectory -->
```

That module renders the sticky navbar (Home · Lessons · Assignments · Reference, plus a right-aligned **Next**) and the bottom prev/next pager. Both come from the `SECTIONS` array at the top of `site-nav.js`, so **page order lives in exactly one place**. Rules:

- **Next advances within a section only** (`lessons`, `assignments`, `reference`, `tools`). The last page of a section gets **no** Next link — it is omitted, never rendered dead or disabled. Same for a page absent from the map (`lessons/square.html`).
- All links resolve against `import.meta.url`, so nothing is root-absolute and the site works from the repo root, a subdirectory, and a GitHub Pages project base.
- The module injects its own CSS, so pages with inline `<style>` need no extra `<link>`. It uses the shared `--ink/--muted/--line/--accent` custom properties with literal fallbacks.
- Off-map pages can still get links: `data-prev`/`data-prev-label` (and `data-next`/`data-next-label`) on the script tag, or the exported `setNext(href, label)` for a successor only known at runtime — that's how `assignments/assignment.html` chains `?id=` to the next assignment.
- Don't reintroduce hand-written `<nav class="pager">` blocks; they were removed from all 35 pages that had them, and `.pager` no longer exists in `lesson.css`.

## Assignments & grading

The `assignments/` + `tools/` layer adds **graded coursework** on top of the same simulator. A lesson challenge is formative (instant ✓ only); an assignment is that *plus* a submit path and an authoritative teacher-side re-grade. Key pieces and invariants:

- **Two grades, one solution.** The instant in-browser ✓ is practice; the **grade of record** is `tools/grade.js` re-running the submission headlessly. Both compare against the *same* solution using the same aspects (`check`) — so keep the browser and CLI paths grading identically. The browser path reuses `runKarel`/`runKarelInWorker`; the CLI path uses `gradeKarel` (no canvas/`gif.js`, so it runs in Node).
- **Sealed solutions.** An assignment manifest stores its solution as a `sealSolution()` string, **never plaintext**, so it isn't trivially readable in page source. This is obfuscation, not security (the key is embedded in `stanfordkarel.js`) — integrity comes from the CLI re-grade, not the cipher. Re-seal after editing a solution: `node tools/seal.js <plaintext.js>`.
- **`gradeKarel` is the single headless grader.** It wraps the existing `computeSolutionState` + `statesMatch`/`matchesEnd`. Reuse it; don't hand-roll state comparison. It accepts a `main` function *or* program source text for both `program` and `solution`.
- **Infinite-loop safety differs by side.** The browser isolates student code in a Web Worker (`isolate: true`). The CLI runs each `gradeKarel` in a `worker_threads` worker that `grade.js` kills after `--timeout` ms — necessary because `gradeKarel`/`computeSolutionState` have **no frame cap** (that guard lives only in `runKarel`'s render loop). Don't call `gradeKarel` on untrusted code without a timeout wrapper.
- **Two manifest shapes.** A *standalone* assignment (`collect-all.js`) carries `world`/`prompt`/`solution`/`check` at the top level. A *lesson* assignment (`lesson-NN.js`) instead carries a `problems` array of three (`key` ∈ `simple`/`moderate`/`complex`, each with its own `world`/`prompt`/`starter`/`check`/`end`/sealed `solution`) plus `lessonSlug`/`lessonTitle` for the cross-link back to `lessons/NN-*.html`. `assignment.js` normalizes the standalone form into a one-element `problems` array, so the renderer only handles the array shape.
- **Per-lesson assignments are generated.** `tools/gen-lesson-assignments.js` is the single source of truth for the 18 lesson assignments: it holds the **plaintext** solutions, verifies each headlessly (the solution must match itself; the starter must *not* already solve), seals them, and writes `assignments/lesson-NN.js`. Never hand-edit those files — edit the generator and rerun `node tools/gen-lesson-assignments.js` (`--check` verifies without writing).
- **Submission format.** `submissions/<id>.js` starts with `// ` header comment lines (`assignment: <id>` tags the file). A standalone submission carries a single `function problem_1()` wrapper (the grader also accepts a bare top-level `main`, for a hand-written submission). A lesson submission frames each problem as `function problem_<n>() { …student code…; return main; }` — `n` is the problem's 1-based position in the assignment — the outer wrapper lets all three coexist in one file; the grader unwraps each (`grade-worker.js`) and grades it against that problem's sealed solution. The whole file compiles as-is (comments/wrappers are harmless), so no export/import to strip. `tools/grade.js` sums per-problem points for a lesson assignment; a lesson counts as fully solved only when all three problems pass.

### Adding an assignment

**A per-lesson assignment** (three problems): add or edit its entry in `tools/gen-lesson-assignments.js` (`LESSONS[n]`), run `node tools/gen-lesson-assignments.js` to regenerate `assignments/lesson-NN.js`, then wire it in `assignments/index.js` and add a `<li>` to `assignments/index.html`. Cross-link the lesson page with an `.assign-cta` block.

**A standalone assignment:**
1. Write the plaintext solution to a scratch file and seal it: `node tools/seal.js sol.js` (add `--check` to verify the round-trip).
2. Create `assignments/<id>.js` exporting a manifest (`id`, `title`, `points`, `world`, `prompt` HTML, `starter`, `check`, optional `end`, and the sealed `solution`). Mirror `assignments/collect-all.js`, including the plaintext-solution comment in its JSDoc header so the answer stays re-derivable.
3. Re-export it from `assignments/index.js` **and** add it to the `assignments` array — that's what `tools/grade.js` grades, so this alone makes it gradeable at `assignments/assignment.html?id=<id>`.
4. Add a matching `<li>` to the **static** list in `assignments/index.html` (the list is intentionally static HTML — no JS — so it renders even if module loading is blocked; mirror the existing row).
5. It's published (the `assignments/` glob is in `files`). No new HTML per assignment — `assignment.html` is generic and reads `?id=`.

## Reset backups (teacher recovery)

The Reset button under a lesson challenge or an assignment problem is destructive, so it arms an inline warning box (`.reset-confirm`, styled in `lessons/lesson.css`) and only erases on confirm. The warning tells the student the erase cannot be undone — **that wording is deliberate**, because a student who knows about an undo clicks Reset carelessly — but the confirm handler first calls `backupCode()` from `code-backup.js`, which keeps the last 5 versions per editor:

```
karel-backup:assignment:<assignmentId>:<problemKey>   →  [{ts, code, label, page}, …]
karel-backup:lesson:<pageSlug>:<challengeIndex>       →  [{ts, code, label, page}, …]
```

This is a per-origin, per-browser-profile safety net, not a sync service: it never leaves the student's machine, and it is separate from the live `karel-assignment:…` keys the assignment page saves to during normal work.

To recover, at the student's browser: add `?recover=1` to the page URL for a panel listing every backup (Restore is live for editors on the current page; other slots show their source to copy), or use `karelBackups` in the console — `list()`, `dump(scope)`, `restore(scope, index)`, `panel()`. If a lesson or assignment card gains another editor, register it with `registerSlot()` so Restore has somewhere to write.

## Verifying changes (no test runner)

Open the relevant page in a browser and watch the animation:

- Library change → open `lessons/square.html` (exercises `runKarel`, bundled world, most Karel methods).
- Course change → open `index.html` and click through the lessons.
- Assignment change → open `assignments/assignment.html?id=collect-all` (goal builds, Run gives ✓ on a correct answer, Copy submission works, work survives reload). Grader change → `node tools/grade.js --roster <local.json>` against a scratch repo dir with a correct and a wrong `submissions/*.js`.
- `gradeKarel`/cipher change → quick headless check: `node -e "import('./stanfordkarel.js').then(async m=>{const s=m.sealSolution('function main(k){k.move();}');console.log(m.unsealSolution(s));console.log(await m.gradeKarel('Dimension: (3,1)\nKarel: (1,1); east','function main(k){k.move();}',{solution:m.unsealSolution(s),check:['position']}))})"`.
- Serve statically if needed: `python3 -m http.server` then browse to the page. ES module imports from CDN require `http://`/`https://`, not `file://`.

## Publishing (maintenance)

```bash
npm whoami                 # must be the package owner; else: npm login
npm pack --dry-run         # confirm stanfordkarel.js + worlds/ are listed
npm version patch|minor|major   # bumps, commits, tags (needs clean tree)
npm publish                # 2FA prompt if enabled
git push && git push --tags
```

- `patch` = bugfix, `minor` = new feature/world, `major` = breaking API change.
- `npm version` refuses to run on a dirty working tree — commit first.
- After bumping, update any versioned CDN URLs referenced in `README.md`.
