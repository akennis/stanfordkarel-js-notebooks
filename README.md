# Stanford Karel — JavaScript

A JavaScript port of the [Stanford Karel](https://github.com/TylerYep/stanfordkarel) robot programming library (CS 106A). Karel programs run entirely in the browser and render as inline animated GIFs — no desktop window, Python environment, or build step required.

The package ships two things:

- **A library** (`stanfordkarel.js`) you can drop into any browser page, JavaScript notebook ([Observable](https://observablehq.com/), etc.), or bundler project. Call `runKarel(world, program)` and get back an animated `<img>`.
- **An interactive course** (`index.html` + `lessons/`) — *Learning JavaScript with Karel* — ten short, notebook-style lessons that teach programming fundamentals by driving Karel around a grid.

---

## Learning JavaScript with Karel (the course)

Open `index.html` in a browser to start the course. It's a self-contained, no-setup introduction to programming: each lesson mixes plain-English explanations with real JavaScript, and every code snippet is brought to life as an animated Karel program right on the page.

The ten lessons build on one another in order:

| # | Lesson | Concept |
|---|---|---|
| 01 | Commands & Sequencing | Programs are lists of commands that run in order |
| 02 | Functions | Bundle commands into reusable, named building blocks |
| 03 | The `for` Loop | Repeat something a fixed number of times |
| 04 | The `while` Loop | Repeat until a condition changes |
| 05 | Making Decisions with `if` | Booleans, and running code only when a condition holds |
| 06 | `if` / `else` | Choose between two different actions |
| 07 | Parameters | Functions that take input and adapt their behaviour |
| 08 | Variables | Give a program a memory: store, read, and update values |
| 09 | Return Values & Logic | Functions that answer questions; `and` / `or` / `not` |
| 10 | Putting It All Together | Nested loops and every concept, in one program |

Each lesson is a standalone HTML page under `lessons/` that pulls the library from a CDN, so the pages work as static files — serve the folder (or the whole repo) over any static host, or open a page directly. `lessons/square.html` is a longer, standalone demo (Karel walks a perimeter collecting beepers).

### How the lesson pages are built

Lesson pages import a tiny helper, `renderNotebook`, from `lessons/lesson.js`. You hand it an array of **cells** — either a markdown block or a runnable Karel cell — and it renders a notebook-style page, syntax-highlighting the code and running each program to produce the animation beneath it.

```javascript
import { renderNotebook } from "./lesson.js";

renderNotebook([
  { md: `<h2>Meet Karel</h2><p>Karel takes three steps east.</p>` },
  {
    world: `Dimension: (5, 5)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
    code: function main(k) {
      k.move();
      k.move();
      k.move();
    },
  },
]);
```

- `{ md }` — an HTML/markdown block, rendered as prose.
- `{ world, code, opts }` — a Karel cell. `world` is a world string, `code` is the `main` function (its source is shown, then executed), and `opts` are optional `runKarel` options.

If a program hits a wall, the partial animation still renders with Karel drawn in red at the offending corner, and the error is shown below it, so a mistake is visible rather than silent.

---

## Using the library

### In a plain HTML page

Import the module straight from a CDN — no bundler needed:

```html
<div id="out"></div>
<script type="module">
  import { runKarel } from "https://esm.sh/stanfordkarel-js-notebooks/stanfordkarel.js";

  const img = await runKarel(`
    Dimension: (5, 5)
    Karel: (1, 1); east
    BeeperBag: INFINITY
  `, function main(k) {
    while (k.frontIsClear()) k.move();
    k.turnLeft();
    while (k.frontIsClear()) k.move();
  });

  document.getElementById("out").appendChild(img);
</script>
```

### In Observable

Upload `stanfordkarel.js` as a file attachment and load it as an ES module:

```javascript
stanfordkarel = FileAttachment("stanfordkarel.js")
```

```javascript
karel = import(await stanfordkarel.url())
```

…or import it directly from a CDN:

```javascript
karel = import("https://esm.sh/stanfordkarel-js-notebooks/stanfordkarel.js")
```

Then run a program — the returned `<img>` displays inline in the cell:

```javascript
animation = karel.runKarel(`
  Dimension: (5, 5)
  Karel: (1, 1); east
  BeeperBag: INFINITY
`, function main(k) {
  while (k.frontIsClear()) k.move();
  k.turnLeft();
  while (k.frontIsClear()) k.move();
})
```

> Observable has no npm resolver, so static `import … from "bare-package"` raises an `UnexpectedToken` error. Use a dynamic `import()` against a CDN URL (or a file attachment) instead.

### With a bundler (Vite / webpack / esbuild) or Node

Static imports with the bare package specifier work here, since npm resolution is available:

```javascript
import * as karel from "stanfordkarel-js-notebooks";

const img = await karel.runKarel(karel.worlds.square, main);
document.body.appendChild(img);
```

### Python-style syntax

If you'd rather call functions without the `k.` prefix, destructure the API from the argument:

```javascript
runKarel(worldText, function main({ move, turnLeft, frontIsClear, putBeeper }) {
  while (frontIsClear()) move();
})
```

---

## `runKarel(worldText, mainFunc, options?)`

Runs a Karel program and returns a `Promise<HTMLImageElement>` — an animated GIF ready to display.

If the program throws (e.g. Karel hits a wall), the promise still resolves with the **partial** animation, ending on a frame that draws Karel in red at the offending corner; the error message is available on `img.dataset.error` and as the element's tooltip (`img.title`).

`mainFunc` receives a Karel instance (or, destructured, its methods) and may be `async`.

| Option | Type | Default | Description |
|---|---|---|---|
| `cellSize` | `number` | `50` | Pixels per grid cell |
| `delay` | `number` | `100`\* | Milliseconds per animation frame |
| `finalFrameDelay` | `number` | `1000` | Extra pause on the last frame (ms) |
| `icon` | `"karel"` \| `"simple"` | `"karel"` | Robot sprite style |
| `gifWorkers` | `number` | `2` | Web workers used by gif.js |
| `maxFrames` | `number` | `2000` | Cap on captured frames. Each Karel action yields one frame, so hitting the cap ends the run with a soft error (red final frame + `img.dataset.error`) — a guard against loops that call Karel actions. A loop that never acts (`while (true) {}`) still hangs the main thread; use [`runKarelInWorker`](#runkarelinworkerworldtext-programtext-options) for that. |
| `solution` | `Function` | — | Optional reference program. Its final state (run on a fresh copy of the world) is compared to this run's; an extra final frame draws Karel **green** on a match (with `img.dataset.solved` set to `"true"`) or **red** on a mismatch. |
| `check` | `string[]` | `["beepers","position","direction","colors"]` | Which aspects the `solution` comparison grades on (`"colors"` compares painted corner colors) |
| `end` | `{ avenue?, street?, direction? }` | — | Optional explicit end pose. When given, Karel must finish at the specified avenue/street/direction (any subset) to count as solved. ANDs with the `solution` check when both are supplied; either alone drives the green frame and `img.dataset.solved`. |

\* If the world includes a `Speed:` directive, that value sets the default delay (`delay = round(100 / speed)` ms, so Speed 2.0 → 50 ms, Speed 0.5 → 200 ms). An explicit `delay` option always takes precedence.

When a `solution` and/or an explicit `end` pose is supplied and the run satisfies every supplied check, the promise resolves with `img.dataset.solved === "true"` and the animation ends on a green Karel; if a check is supplied but not satisfied, `img.dataset.solved` is unset and the animation ends on a red Karel. `statesMatch(reader, goal, aspects)` and `matchesEnd(state, end)` are also exported for comparing states directly.

---

## `runKarelInWorker(worldText, programText, options?)`

Same result as `runKarel` — a `Promise<HTMLImageElement>` — but the program runs inside a **Web Worker**, so an infinite loop can never freeze the page. The Worker simulates Karel and streams a world snapshot per action back to the main thread, which renders those snapshots into the GIF and can hard-kill a runaway program by terminating the Worker.

The program is passed as a **source string**, not a function: a function can't cross a Worker boundary (structured clone rejects functions and closures don't transfer). The string must define `function main(k)` — helpers may sit alongside it, and `main` may be `async` or use the destructured form `function main({ move, turnLeft }) { … }`.

```javascript
import { runKarelInWorker } from "https://esm.sh/stanfordkarel-js-notebooks/stanfordkarel.js";

const img = await runKarelInWorker(
  `Dimension: (5, 5)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
  `function main(k) {
     while (true) k.turnLeft();   // never freezes — stopped by maxFrames / timeout
   }`,
  { maxFrames: 500, timeout: 2000 }
);
document.body.appendChild(img);
```

It accepts the same rendering options as `runKarel` (`cellSize`, `delay`, `finalFrameDelay`, `gifWorkers`, `icon`, `maxFrames`) plus one more:

| Option | Type | Default | Description |
|---|---|---|---|
| `timeout` | `number` | `3000` | Wall-clock budget (ms) before the Worker is terminated. This is the backstop for a spin that never captures a frame (e.g. `while (true) {}` with no Karel call) and so can't trip `maxFrames`. |

Whether the program hits a wall, exhausts `maxFrames`, or blows the `timeout`, the promise still resolves with the partial animation, ending on a red Karel at its last known corner; the message is on `img.dataset.error` / `img.title`.

> Requires a browser Worker environment with cross-origin ES-module import (the Worker imports `stanfordkarel.js` from the same URL the library was loaded from). `runKarel` remains the choice for Node, `solution`/`end` grading, or passing a live function.

---

## API Reference

### Actions

| Function | Description |
|---|---|
| `k.move()` | Move one step forward. Throws if blocked by a wall or boundary. |
| `k.turnLeft()` | Rotate 90° counterclockwise. |
| `k.putBeeper()` | Place a beeper at the current corner. Throws if bag is empty. |
| `k.pickBeeper()` | Pick up a beeper from the current corner. Throws if none present. |
| `k.paintCorner(color)` | Paint the current corner a color (use a color constant). |

### Conditions

| Function | Returns `true` when… |
|---|---|
| `k.frontIsClear()` | No wall or boundary ahead |
| `k.frontIsBlocked()` | Wall or boundary ahead |
| `k.leftIsClear()` | No wall or boundary to the left |
| `k.leftIsBlocked()` | Wall or boundary to the left |
| `k.rightIsClear()` | No wall or boundary to the right |
| `k.rightIsBlocked()` | Wall or boundary to the right |
| `k.beepersPresent()` | At least one beeper on the current corner |
| `k.noBeepersPresent()` | No beepers on the current corner |
| `k.beepersInBag()` | At least one beeper in Karel's bag |
| `k.noBeepersInBag()` | Karel's bag is empty |
| `k.facingNorth()` | Karel faces north |
| `k.facingEast()` | Karel faces east |
| `k.facingSouth()` | Karel faces south |
| `k.facingWest()` | Karel faces west |
| `k.notFacingNorth()` | Karel does not face north |
| `k.notFacingEast()` | Karel does not face east |
| `k.notFacingSouth()` | Karel does not face south |
| `k.notFacingWest()` | Karel does not face west |
| `k.cornerColorIs(color)` | Current corner is painted the given color |

### Color Constants

```javascript
const { RED, BLACK, CYAN, DARK_GRAY, GRAY, GREEN, LIGHT_GRAY,
        MAGENTA, ORANGE, PINK, WHITE, BLUE, YELLOW, BLANK } = karel;
```

Use these with `k.paintCorner(karel.RED)`, or destructure them directly.

---

## World File Format

Worlds are plain-text strings, one directive per line — the same `.w` format used by the Python library.

```
Dimension: (num_avenues, num_streets)
Karel: (avenue, street); direction
BeeperBag: num_beepers         (or INFINITY)
Beeper: (avenue, street); count
Wall: (avenue, street); direction
Color: (avenue, street); color
Speed: speed
```

- **Avenues** run north–south (columns, x-axis)
- **Streets** run east–west (rows, y-axis)
- Coordinates are 1-indexed from the south-west corner
- `direction` is one of: `north`, `south`, `east`, `west`

### Example world

```
Dimension: (8, 8)
Karel: (1, 1); east
BeeperBag: INFINITY
Beeper: (4, 4); 3
Wall: (2, 1); north
Wall: (2, 2); north
Wall: (2, 3); north
```

---

## Bundled Worlds

Ready-made worlds ship as importable ES modules under `worlds/`. Each is a plain-text world string (its default export), so you can hand it straight to `runKarel`. They're also re-exported on the library object as `karel.worlds`.

| World | Description |
|---|---|
| `square` | 9×9 grid with 16 beepers around a 5×5 inner square; Karel at (1, 1) facing east with an empty bag. |

```javascript
// Via the library object (works everywhere the library is loaded):
karel.runKarel(karel.worlds.square, main)
```

```javascript
// Via CDN — the whole collection…
worlds = import("https://esm.sh/stanfordkarel-js-notebooks/worlds/index.js")
// …or a single world module (default export is the world string):
square = (await import("https://esm.sh/stanfordkarel-js-notebooks/worlds/square.js")).default
```

```javascript
// With a bundler / Node:
import { square } from "stanfordkarel-js-notebooks/worlds";
import square from "stanfordkarel-js-notebooks/worlds/square";
```

Pin a version by appending `@x.y.z` to the package name on a CDN URL, e.g. `https://esm.sh/stanfordkarel-js-notebooks@0.5.0/worlds/square.js`.

---

## `fetchWorld(url)`

Convenience helper that fetches a `.w` world file from a URL and returns its text.

```javascript
worldText = await karel.fetchWorld("https://example.com/worlds/my_world.w")
animation = karel.runKarel(worldText, main)
```

---

## Assignments & grading

On top of the notebook challenges, the repo ships an **assignments** workflow for graded coursework: students solve an exercise, get an instant in-browser ✓ for practice, then **submit** their code — by pushing `submissions/<id>.js` to their own repository (preferred) or pasting it into a shared doc. The instructor re-grades every submission **headlessly** — the grade of record — with the same simulator the browser uses.

- **Per-lesson assignments** — every lesson (`lessons/NN-*.html`) has a companion assignment (`assignments/assignment.html?id=lesson-NN`) with **three problems**: simple, moderate, and complex. The two pages are cross-linked. These manifests are **generated** by `tools/gen-lesson-assignments.js`, which holds the plaintext solutions, verifies each headlessly, and writes the sealed `assignments/lesson-NN.js`. Regenerate with `node tools/gen-lesson-assignments.js` (add `--check` to only verify).
- **Student page** — `assignments/assignment.html?id=<id>` renders each problem (goal GIF, editor, instant check) and, at the page bottom, **one combined submission textarea** covering all three. Every problem's code is auto-framed in an outer function (`function problem_<key>() { … return main; }`) so the single file a student copies contains all three solutions and a grader can run each independently. Assignments are listed at `assignments/index.html`.
- **Teacher grader** — `tools/grade.js` reads a roster, pulls each student repo, and grades every submission in an isolated worker (with a timeout, so an infinite loop can't hang the run), emitting `gradebook.json` and a printed table. It handles both shapes: a standalone single-problem assignment, and a lesson assignment (it unwraps each framed `problem_<key>()` and awards per-problem points).

```bash
# Grade everyone in a roster (see tools/roster.example.json for the format)
node tools/grade.js --roster tools/roster.json
#   --cache <dir>    where student repos are cloned (default .grade-cache)
#   --out <file>     gradebook JSON (default gradebook.json)
#   --timeout <ms>   per-submission budget (default 5000)
#   --no-pull        grade already-cloned repos without git pull
```

A `repoUrl` in the roster may be a git URL **or** a local path (used in place — handy for testing).

### Grading API

These functions are part of the public library, usable in Node or the browser:

| Function | Returns | Purpose |
|---|---|---|
| `gradeKarel(worldText, program, { solution, check, end })` | `Promise<{ solved, state, error }>` | Run a program against a world and compare its final state to a reference `solution` and/or `end` pose — **no rendering** (no canvas/`gif.js`), so it runs in Node. `program`/`solution` may be a `main` function or its source string. Errors are soft (a throw yields `{ solved: false, error }`). |
| `compileProgram(src)` | `Function` | Compile Karel program source text into a callable `main()` (throws on a syntax error or a missing `main`). |
| `sealSolution(src)` / `unsealSolution(cipher)` | `string` | Reversibly obfuscate / recover a solution string so an assignment page can embed it without shipping plaintext. **Obfuscation, not encryption** — the authoritative grade is the headless re-grade, so a student who recovers the key gains nothing gradeable. |

> Authoring an assignment solution: write the plaintext `main` in a file and run `node tools/seal.js solution.js` to print the sealed string to paste into the manifest's `solution:` field.

---

## Complete Example

Karel navigates from the south-west corner to a 5×5 inner square and collects all 16 beepers around its perimeter:

```javascript
const worldText = karel.worlds.square;

function main(k) {
  function turnRight() {
    k.turnLeft(); k.turnLeft(); k.turnLeft();
  }
  function walkAndPick(steps) {
    for (let i = 0; i < steps; i++) {
      k.move();
      if (k.beepersPresent()) k.pickBeeper();
    }
  }

  // Navigate to the bottom-left corner of the inner square
  k.move(); k.move();  // east to avenue 3
  k.turnLeft();        // face north
  k.move(); k.move();  // north to street 3
  k.pickBeeper();      // pick corner beeper at (3, 3)

  walkAndPick(4);  // up the left side:    (3,4) → (3,7)
  turnRight();     // face east
  walkAndPick(4);  // across the top:      (4,7) → (7,7)
  turnRight();     // face south
  walkAndPick(4);  // down the right side: (7,6) → (7,3)
  turnRight();     // face west
  walkAndPick(3);  // back along bottom:   (6,3) → (4,3)
}

animation = karel.runKarel(worldText, main, { cellSize: 60, delay: 150 });
```

See `lessons/square.html` for this example running as a standalone page.

---

## Repository layout

| Path | Purpose |
|---|---|
| `stanfordkarel.js` | The library — world parser, simulator, and GIF renderer |
| `worlds/` | Bundled world modules (`index.js`, `square.js`, …) |
| `index.html` | Landing page for the *Learning JavaScript with Karel* course |
| `site-nav.js` | Shared navbar and prev/next pager for every page, driven by one site map |
| `lessons/` | The ten lesson pages, plus `lesson.js` / `lesson.css` and the `square.html` demo |
| `assignments/` | Graded-assignment manifests (`index.js`, `collect-all.js`, …) and the shared student page (`assignment.html` / `assignment.js`) |
| `tools/` | `grade.js` (teacher batch grader), `grade-worker.js`, `seal.js` (solution-sealing helper), `roster.example.json` |
| `student-template/` | Starter repo layout students copy to submit their work |

Published to npm (see the `files` field in `package.json`): `stanfordkarel.js`, `worlds/`, `assignments/`, `tools/`, `LICENSE`, and `README.md`. The course pages (`index.html`, `lessons/`, `site-nav.js`, `student-template/`) live in the repo and are meant to be served as static files.

---

## Publishing to npm

The package is published at [npmjs.com/package/stanfordkarel-js-notebooks](https://www.npmjs.com/package/stanfordkarel-js-notebooks). To cut a new release:

```bash
# 1. Ensure you're logged in as the package owner
npm whoami            # if this errors, run: npm login

# 2. Verify the published file list (stanfordkarel.js + worlds/ should appear)
npm pack --dry-run

# 3. Bump the version — commits the change and creates a git tag.
#    patch = bugfix, minor = new feature (e.g. new worlds), major = breaking change
npm version minor

# 4. Publish to npm
npm publish

# 5. Push the version commit and tag to GitHub
git push && git push --tags
```

Notes:
- Commit all working-tree changes first — `npm version` refuses to run on a dirty tree.
- Only files in the `files` array of `package.json` are published, so new worlds added under `worlds/` are included automatically.
- If 2FA is enabled on your npm account, `npm publish` will prompt for a one-time code.

---

## License

MIT
