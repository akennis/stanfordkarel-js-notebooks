# Stanford Karel — JavaScript

A JavaScript port of the [Stanford Karel](https://github.com/TylerYep/stanfordkarel) robot programming library (CS 106A), designed for [Observable](https://observablehq.com/) notebooks. Karel programs render as inline animated GIFs — no desktop window or Python environment required.

## Usage in Observable

### 1. Attach the file

Upload `stanfordkarel.js` as a file attachment in your notebook, then load it as an ES module:

```javascript
stanfordkarel = FileAttachment("stanfordkarel.js")
```

```javascript
karel = import(await stanfordkarel.url())
```

### 2. Define a world and run a program

```javascript
animation = karel.runKarel(`
  Dimension: (5, 5)
  Karel: (1, 1); east
  BeeperBag: INFINITY
`, function main(k) {
  while (k.front_is_clear()) k.move();
  k.turn_left();
  while (k.front_is_clear()) k.move();
})
```

### 3. Destructure for Python-style syntax

If you prefer calling functions without the `k.` prefix, destructure the API:

```javascript
animation = karel.runKarel(worldText, function main({
  move, turn_left, front_is_clear, beepers_present, pick_beeper, put_beeper
}) {
  while (front_is_clear()) move();
})
```

---

## API Reference

### Actions

| Function | Description |
|---|---|
| `k.move()` | Move one step forward. Throws if blocked by a wall or boundary. |
| `k.turn_left()` | Rotate 90° counterclockwise. |
| `k.put_beeper()` | Place a beeper at the current corner. Throws if bag is empty. |
| `k.pick_beeper()` | Pick up a beeper from the current corner. Throws if none present. |
| `k.paint_corner(color)` | Paint the current corner a color (use a color constant). |

### Conditions

| Function | Returns `true` when… |
|---|---|
| `k.front_is_clear()` | No wall or boundary ahead |
| `k.front_is_blocked()` | Wall or boundary ahead |
| `k.left_is_clear()` | No wall or boundary to the left |
| `k.left_is_blocked()` | Wall or boundary to the left |
| `k.right_is_clear()` | No wall or boundary to the right |
| `k.right_is_blocked()` | Wall or boundary to the right |
| `k.beepers_present()` | At least one beeper on the current corner |
| `k.no_beepers_present()` | No beepers on the current corner |
| `k.beepers_in_bag()` | At least one beeper in Karel's bag |
| `k.no_beepers_in_bag()` | Karel's bag is empty |
| `k.facing_north()` | Karel faces north |
| `k.facing_east()` | Karel faces east |
| `k.facing_south()` | Karel faces south |
| `k.facing_west()` | Karel faces west |
| `k.not_facing_north()` | Karel does not face north |
| `k.not_facing_east()` | Karel does not face east |
| `k.not_facing_south()` | Karel does not face south |
| `k.not_facing_west()` | Karel does not face west |
| `k.corner_color_is(color)` | Current corner is painted the given color |

### Color Constants

```javascript
const { RED, BLACK, CYAN, DARK_GRAY, GRAY, GREEN, LIGHT_GRAY,
        MAGENTA, ORANGE, PINK, WHITE, BLUE, YELLOW, BLANK } = karel;
```

Use these with `k.paint_corner(karel.RED)` or destructure them directly.

---

## `runKarel(worldText, mainFunc, options?)`

Returns a `Promise<HTMLImageElement>` — an animated GIF ready to display in an Observable cell.

| Option | Type | Default | Description |
|---|---|---|---|
| `cellSize` | `number` | `50` | Pixels per grid cell |
| `delay` | `number` | `100`* | Milliseconds per animation frame |
| `finalFrameDelay` | `number` | `1000` | Extra pause on the last frame (ms) |
| `icon` | `"karel"` \| `"simple"` | `"karel"` | Robot sprite style |
| `gifWorkers` | `number` | `2` | Web workers used by gif.js |

\* If the world includes a `Speed:` directive, that value sets the default delay (`delay = 100 / speed` ms). An explicit `delay` option always takes precedence.

---

## World File Format

Worlds are plain text strings, one directive per line. The same `.w` format used by the Python library is supported.

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

Ready-made worlds ship as importable ES modules under `worlds/`. Each is a
plain-text world string, so you can hand it straight to `runKarel`.

| World | Description |
|---|---|
| `square` | 9×9 grid with 16 beepers around a 5×5 inner square; Karel at (1, 1) facing east. |

### In Observable

The bundled worlds are exposed on the library object itself, so once you've
imported `karel` you can reach any world through `karel.worlds`:

```javascript
karel = import("https://esm.sh/stanfordkarel-js-notebooks/stanfordkarel.js")
```

```javascript
animation = karel.runKarel(karel.worlds.square, main)
```

Observable has no npm module resolver, so **static `import … from "…"` with a bare
package name does not work** (it raises an `UnexpectedToken` error). If you'd
rather import the worlds on their own, use a dynamic `import()` against a CDN URL
to grab the whole collection:

```javascript
worlds = import("https://esm.sh/stanfordkarel-js-notebooks/worlds/index.js")
```

```javascript
animation = karel.runKarel(worlds.square, main)
```

…or a single world module (its default export is the world string):

```javascript
square = (await import("https://esm.sh/stanfordkarel-js-notebooks/worlds/square.js")).default
```

Pin a version by appending `@x.y.z` to the package name, e.g.
`https://esm.sh/stanfordkarel-js-notebooks@0.2.0/worlds/square.js`.

If you've uploaded the files to the notebook as attachments, load them from there
instead:

```javascript
worlds = import(await FileAttachment("worlds/index.js").url())
```

### With a bundler (Vite / webpack / esbuild) or Node

Static imports with the bare package specifier work here, since npm resolution is
available:

```javascript
import * as karel from "stanfordkarel-js-notebooks";
animation = karel.runKarel(karel.worlds.square, main);

// or import the worlds directly:
import { square } from "stanfordkarel-js-notebooks/worlds";
// or a single module:
import square from "stanfordkarel-js-notebooks/worlds/square";
```

---

## `fetchWorld(url)`

Convenience helper that fetches a `.w` world file from a URL and returns its text.

```javascript
worldText = karel.fetchWorld("https://example.com/worlds/my_world.w")
```

```javascript
animation = karel.runKarel(await worldText, main)
```

---

## Complete Example

Karel navigates from the south-west corner to a 5×5 inner square and collects all 16 beepers around its perimeter:

```javascript
animation = {
  const worldText = `
Dimension: (9, 9)
Karel: (1, 1); east
BeeperBag: 0
Beeper: (3, 3); 1
Beeper: (4, 3); 1
Beeper: (5, 3); 1
Beeper: (6, 3); 1
Beeper: (7, 3); 1
Beeper: (7, 4); 1
Beeper: (7, 5); 1
Beeper: (7, 6); 1
Beeper: (7, 7); 1
Beeper: (6, 7); 1
Beeper: (5, 7); 1
Beeper: (4, 7); 1
Beeper: (3, 7); 1
Beeper: (3, 6); 1
Beeper: (3, 5); 1
Beeper: (3, 4); 1
`;

  function main(k) {
    function turn_right() {
      k.turn_left(); k.turn_left(); k.turn_left();
    }
    function walkAndPick(steps) {
      for (let i = 0; i < steps; i++) {
        k.move();
        if (k.beepers_present()) k.pick_beeper();
      }
    }

    // Navigate to the bottom-left corner of the inner square
    k.move(); k.move();  // east to avenue 3
    k.turn_left();       // face north
    k.move(); k.move();  // north to street 3
    k.pick_beeper();     // pick corner beeper at (3,3)

    walkAndPick(4);  // up the left side:    (3,4) → (3,7)
    turn_right();    // face east
    walkAndPick(4);  // across the top:      (4,7) → (7,7)
    turn_right();    // face south
    walkAndPick(4);  // down the right side: (7,6) → (7,3)
    turn_right();    // face west
    walkAndPick(3);  // back along bottom:   (6,3) → (4,3)
    k.move();        // return to start — already cleared
  }

  return karel.runKarel(worldText, main, { cellSize: 60, delay: 150 });
}
```

---

## Publishing to npm

The package is published at
[npmjs.com/package/stanfordkarel-js-notebooks](https://www.npmjs.com/package/stanfordkarel-js-notebooks).
To cut a new release:

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
- Only files in the `files` array of `package.json` are published, so new worlds
  added under `worlds/` are included automatically.
- If 2FA is enabled on your npm account, `npm publish` will prompt for a one-time code.

---

## License

MIT
