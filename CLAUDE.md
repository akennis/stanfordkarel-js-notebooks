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
| `lessons/` | `01-…10-*.html` lessons, `lesson.js` (`renderNotebook` helper), `lesson.css`, and `square.html` (standalone demo). |
| `package.json` | Only `stanfordkarel.js`, `worlds/`, `LICENSE`, `README.md` are published to npm (`files` field). The course is repo-only, served as static files. |

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

New lessons: copy an existing `NN-*.html`, wire the prev/next `.pager` links, and add an entry to the `<ol class="toc">` in `index.html`. The challenge machinery lives entirely in `lesson.js`/`lesson.css`, so any lesson can add challenge cells.

## Verifying changes (no test runner)

Open the relevant page in a browser and watch the animation:

- Library change → open `lessons/square.html` (exercises `runKarel`, bundled world, most Karel methods).
- Course change → open `index.html` and click through the lessons.
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
