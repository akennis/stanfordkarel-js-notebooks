# CLAUDE.md

Guidance for working in this repo. Read this before editing; it captures conventions that aren't obvious from any single file.

## What this is

A browser-native JavaScript port of Stanford Karel (CS 106A). It ships two things:

1. **The library** — `stanfordkarel.js`, a single self-contained ES module that parses a world, simulates a Karel program, and renders the run as an animated GIF. Returns an `<img>`.
2. **The course** — `index.html` + `lessons/`, a ten-lesson "Learning JavaScript with Karel" tutorial. Static HTML pages that import the library from a CDN.

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
- **Errors are soft.** `runKarel` wraps `mainFunc` in try/catch. A thrown error (e.g. Karel hitting a wall) does not reject the promise — the partial animation still renders and the message is attached to `img.dataset.error` and `img.title`. Preserve this behavior; lessons rely on it to show mistakes.
- **`mainFunc` may be sync or async**, and `runKarel` calls it as `mainFunc(karel)` — passing the `KarelProgram` instance. The canonical form is `function main(k) { k.move(); }`.
- **Gotcha — the destructured `function main({ move, turnLeft })` form is fragile.** Karel methods use `this` and are **not** bound in the constructor, so destructuring detaches them and a bare `move()` call would lose `this`. The docs/README show this prefix-free style; if you touch the method definitions or `runKarel`'s invocation, verify it in a browser, and if you want it to genuinely work, bind the public methods in the constructor (don't silently leave the docs claiming something the code doesn't support).
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
- **Don't hardcode CDN version numbers** in library source or lesson imports beyond what's already there; when you must reference a version, prefer the unversioned `esm.sh/stanfordkarel-js-notebooks/...` form. The README pins examples to the current `package.json` version — update those together.
- When changing the public API (`runKarel` options, Karel methods, color constants, world directives), **update `README.md` in the same change** — its API tables are meant to stay authoritative.

## Adding a world

1. Create `worlds/<name>.js`: `export const <name> = \`...world text...\`;` and `export default <name>;`. Mirror the JSDoc header style of `square.js`.
2. Re-export it from `worlds/index.js`.
3. It's automatically published (the `worlds/` glob is in `files`) and reachable as `karel.worlds.<name>`.
4. Add a row to the "Bundled Worlds" table in `README.md`.

## Adding / editing a lesson

Lessons are static HTML using `renderNotebook(cells)` from `lessons/lesson.js`. Each cell is either `{ md }` (HTML prose) or `{ world, code, opts }` where `code` is a `function main(k) {...}` whose **source is displayed** (via `Function.prototype.toString`) and then executed. Keep `code` bodies clean and readable — the learner sees them verbatim. New lessons: copy an existing `NN-*.html`, wire the prev/next `.pager` links, and add an entry to the `<ol class="toc">` in `index.html`.

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
