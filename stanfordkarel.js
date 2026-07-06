/**
 * Stanford Karel for Observable Notebooks
 *
 * A JavaScript port of the Stanford Karel library (CS 106A).
 * Renders Karel programs as animated GIFs using gif.js.
 *
 * Observable usage:
 *
 *   karel = import("https://raw.githubusercontent.com/.../stanfordkarel.js")
 *
 *   animation = karel.runKarel(`
 *     Dimension: (5, 5)
 *     Karel: (1, 1); east
 *     BeeperBag: INFINITY
 *   `, function main(k) {
 *     while (k.frontIsClear()) k.move();
 *     k.turnLeft();
 *     while (k.frontIsClear()) k.move();
 *   })
 *
 * Or destructure the API for a terser, prefix-free style:
 *
 *   animation = karel.runKarel(worldText, function main({
 *     move, turnLeft, frontIsClear, beepersPresent, putBeeper
 *   }) {
 *     while (frontIsClear()) { move(); }
 *     if (beepersPresent()) { putBeeper(); }
 *   })
 */

// ─────────────────────────────── WORLDS ─────────────────────────────────────

/**
 * Bundled Karel worlds, exposed as a namespace so they can be reached straight
 * off the library object:
 *
 *   karel = import("https://esm.sh/stanfordkarel-js-notebooks@0.2.0/stanfordkarel.js")
 *   animation = karel.runKarel(karel.worlds.square, main)
 */
export * as worlds from "./worlds/index.js";

// ─────────────────────────── COLOR CONSTANTS ────────────────────────────────

export const RED = "Red";
export const BLACK = "Black";
export const CYAN = "Cyan";
export const DARK_GRAY = "Dark Gray";
export const GRAY = "Gray";
export const GREEN = "Green";
export const LIGHT_GRAY = "Light Gray";
export const MAGENTA = "Magenta";
export const ORANGE = "Orange";
export const PINK = "Pink";
export const WHITE = "White";
export const BLUE = "Blue";
export const YELLOW = "Yellow";
export const BLANK = "";

// Map Karel color names to CSS colors (mirrors Python's COLOR_MAP)
const CSS_COLORS = {
  Red: "red",
  Black: "black",
  Cyan: "cyan",
  "Dark Gray": "#4d4d4d",   // tkinter gray30
  Gray: "#8c8c8c",          // tkinter gray55
  Green: "green",
  "Light Gray": "#cccccc",  // tkinter gray80
  Magenta: "#cd00cd",       // tkinter magenta3
  Orange: "orange",
  Pink: "pink",
  White: "#fffafa",         // tkinter snow
  Blue: "blue",
  Yellow: "yellow",
};

// ─────────────────────────── WORLD PARSER ───────────────────────────────────

class KarelWorld {
  constructor() {
    this.numAvenues = 1;
    this.numStreets = 1;
    /** @type {Map<string, number>} "avenue,street" → count */
    this.beepers = new Map();
    /** @type {Set<string>} "avenue,street,direction" */
    this.walls = new Set();
    /** @type {Map<string, string>} "avenue,street" → color name */
    this.cornerColors = new Map();
    this.karelAvenue = 1;
    this.karelStreet = 1;
    this.karelDirection = "east";
    this.karelBeeperCount = 0;
    /** @type {number|null} Speed directive value (frames/sec multiplier); null if unset */
    this.karelSpeed = null;
  }

  /**
   * Parse a world file from its text contents.
   * Accepts the same format as the Python library.
   */
  loadFromText(text) {
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx === -1) continue;

      const keyword = trimmed.slice(0, colonIdx).trim().toLowerCase();
      const params = trimmed.slice(colonIdx + 1).trim();       // original case
      const paramsLow = params.toLowerCase();

      const coordMatch = paramsLow.match(/\((\d+),\s*(\d+)\)/);
      const avenue = coordMatch ? parseInt(coordMatch[1]) : null;
      const street = coordMatch ? parseInt(coordMatch[2]) : null;

      const dirMatch = paramsLow.match(/\b(north|south|east|west)\b/);
      const direction = dirMatch ? dirMatch[1] : null;

      const numMatch = paramsLow.replace(/\(.*?\)/, "").match(/\d+/);
      const num = numMatch ? parseInt(numMatch[0]) : null;

      switch (keyword) {
        case "dimension":
          if (avenue !== null) { this.numAvenues = avenue; this.numStreets = street; }
          break;

        case "karel":
          if (avenue !== null) { this.karelAvenue = avenue; this.karelStreet = street; }
          if (direction) this.karelDirection = direction;
          break;

        case "beeper":
          if (avenue !== null && num !== null) {
            const key = `${avenue},${street}`;
            this.beepers.set(key, (this.beepers.get(key) ?? 0) + num);
          }
          break;

        case "wall":
          if (avenue !== null && direction) {
            this.walls.add(`${avenue},${street},${direction}`);
          }
          break;

        case "beeperbag":
          if (paramsLow.includes("infinity") || paramsLow.includes("infinite")) {
            this.karelBeeperCount = Infinity;
          } else if (num !== null) {
            this.karelBeeperCount = num;
          }
          break;

        case "color": {
          if (avenue !== null) {
            // Extract color name with original casing, normalize to Title Case
            const colorMatch = params.match(/;\s*(.+)$/);
            if (colorMatch) {
              const colorName = colorMatch[1].trim()
                .split(" ")
                .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                .join(" ");
              this.cornerColors.set(`${avenue},${street}`, colorName);
            }
          }
          break;
        }

        case "speed": {
          // Speed is a positive float; higher = faster animation.
          // Stored here and converted to a GIF frame delay in runKarel().
          const speed = parseFloat(params);
          if (!isNaN(speed) && speed > 0) this.karelSpeed = speed;
          break;
        }
      }
    }
  }

  wallExists(avenue, street, direction) {
    return this.walls.has(`${avenue},${street},${direction}`);
  }

  inBounds(avenue, street) {
    return avenue >= 1 && avenue <= this.numAvenues &&
           street >= 1 && street <= this.numStreets;
  }

  beeperCount(avenue, street) {
    return this.beepers.get(`${avenue},${street}`) ?? 0;
  }

  addBeeper(avenue, street) {
    const key = `${avenue},${street}`;
    this.beepers.set(key, (this.beepers.get(key) ?? 0) + 1);
  }

  removeBeeper(avenue, street) {
    const key = `${avenue},${street}`;
    const count = this.beepers.get(key) ?? 0;
    if (count > 1) this.beepers.set(key, count - 1);
    else this.beepers.delete(key);
  }

  cornerColor(avenue, street) {
    return this.cornerColors.get(`${avenue},${street}`) ?? "";
  }

  paintCorner(avenue, street, color) {
    if (color) this.cornerColors.set(`${avenue},${street}`, color);
    else this.cornerColors.delete(`${avenue},${street}`);
  }
}

// ─────────────────────────── DIRECTION MAPS ─────────────────────────────────

const TURN_LEFT_MAP  = { north: "west",  west: "south", south: "east",  east: "north" };
const TURN_RIGHT_MAP = { north: "east",  east: "south", south: "west",  west: "north" };
const OPPOSITE_MAP   = { north: "south", south: "north", east: "west",  west: "east"  };
const DELTA_MAP      = { north: [0, 1],  east: [1, 0],  south: [0, -1], west: [-1, 0] };

// ─────────────────────────── KAREL PROGRAM ──────────────────────────────────

class KarelProgram {
  constructor(world) {
    this.world = world;
    this.avenue = world.karelAvenue;
    this.street = world.karelStreet;
    this.direction = world.karelDirection;
    this.numBeepers = world.karelBeeperCount;
    /** @type {Array<()=>void>} */
    this._callbacks = [];

    // Bind every public method to this instance so programs can destructure the
    // API for a prefix-free style, e.g.
    //   function main({ move, turnLeft, frontIsClear }) { ... }
    // Detached calls like `move()` would otherwise lose `this`.
    for (const name of Object.getOwnPropertyNames(KarelProgram.prototype)) {
      if (name === "constructor" || name.startsWith("_")) continue;
      if (typeof this[name] === "function") this[name] = this[name].bind(this);
    }
  }

  _notify() {
    for (const cb of this._callbacks) cb();
  }

  /**
   * Returns true if Karel can move in the given direction without hitting a
   * wall or boundary. Checks both the direct wall and the opposite-face wall
   * on the adjacent cell (mirrors Python's direction_is_clear logic).
   */
  _directionIsClear(direction) {
    const [da, ds] = DELTA_MAP[direction];
    const na = this.avenue + da;
    const ns = this.street + ds;
    if (!this.world.inBounds(na, ns)) return false;
    if (this.world.wallExists(this.avenue, this.street, direction)) return false;
    return !this.world.wallExists(na, ns, OPPOSITE_MAP[direction]);
  }

  move() {
    if (!this._directionIsClear(this.direction))
      throw new Error(
        `Karel cannot move from (${this.avenue}, ${this.street}) facing ${this.direction}`
      );
    const [da, ds] = DELTA_MAP[this.direction];
    this.avenue += da;
    this.street += ds;
    this._notify();
  }

  turnLeft() {
    this.direction = TURN_LEFT_MAP[this.direction];
    this._notify();
  }

  putBeeper() {
    if (this.numBeepers === 0)
      throw new Error("Karel tried to put a beeper but has none in its bag");
    this.world.addBeeper(this.avenue, this.street);
    if (isFinite(this.numBeepers)) this.numBeepers--;
    this._notify();
  }

  pickBeeper() {
    if (this.world.beeperCount(this.avenue, this.street) === 0)
      throw new Error(
        `Karel tried to pick up a beeper at (${this.avenue}, ${this.street}) but there are none`
      );
    this.world.removeBeeper(this.avenue, this.street);
    if (isFinite(this.numBeepers)) this.numBeepers++;
    this._notify();
  }

  // ── Sensing ──────────────────────────────────────────────────────────────

  frontIsClear()  { return this._directionIsClear(this.direction); }
  frontIsBlocked() { return !this.frontIsClear(); }

  leftIsClear()   { return this._directionIsClear(TURN_LEFT_MAP[this.direction]); }
  leftIsBlocked() { return !this.leftIsClear(); }

  rightIsClear()   { return this._directionIsClear(TURN_RIGHT_MAP[this.direction]); }
  rightIsBlocked() { return !this.rightIsClear(); }

  beepersPresent()   { return this.world.beeperCount(this.avenue, this.street) > 0; }
  noBeepersPresent() { return !this.beepersPresent(); }

  beepersInBag()   { return this.numBeepers !== 0; }
  noBeepersInBag() { return !this.beepersInBag(); }

  facingNorth()    { return this.direction === "north"; }
  notFacingNorth() { return !this.facingNorth(); }
  facingEast()     { return this.direction === "east";  }
  notFacingEast()  { return !this.facingEast(); }
  facingSouth()    { return this.direction === "south"; }
  notFacingSouth() { return !this.facingSouth(); }
  facingWest()     { return this.direction === "west";  }
  notFacingWest()  { return !this.facingWest(); }

  // ── Color ────────────────────────────────────────────────────────────────

  paintCorner(color) {
    if (color && !Object.hasOwn(CSS_COLORS, color))
      throw new Error(`Invalid Karel color: "${color}"`);
    this.world.paintCorner(this.avenue, this.street, color);
    this._notify();
  }

  cornerColorIs(color) {
    return this.world.cornerColor(this.avenue, this.street) === color;
  }
}

// ─────────────────────────── RENDERER ───────────────────────────────────────

// Shared constants (mirror karel_constants.py)
const BORDER_OFFSET           = 17;
const LABEL_OFFSET            = 7;
const CORNER_SIZE             = 2;
const BEEPER_CELL_SIZE_FRAC   = 0.4;
const LINE_WIDTH              = 2;
const KAREL_LINE_WIDTH        = 2;

// Karel body proportions (fraction of cell size)
const KAREL_LEFT_HORIZONTAL_PAD  = 0.29;
const KAREL_VERTICAL_OFFSET      = 0.05;
const KAREL_WIDTH                = 0.58;
const KAREL_HEIGHT               = 0.76;
const KAREL_INNER_OFFSET         = 0.125;
const KAREL_INNER_WIDTH          = 0.28125;
const KAREL_INNER_HEIGHT         = 0.38;
const KAREL_MOUTH_HORIZONTAL_OFFSET = 0.2625;
const KAREL_MOUTH_VERTICAL_OFFSET   = 0.125;
const KAREL_MOUTH_WIDTH             = 0.1375;
const KAREL_UPPER_RIGHT_DIAG     = 0.2;
const KAREL_LOWER_LEFT_DIAG      = 0.13125;
const KAREL_LEG_VERTICAL_OFFSET  = 0.5;
const KAREL_LEG_LENGTH           = 0.15;
const KAREL_FOOT_LENGTH          = 0.1875;
const KAREL_LEG_FOOT_WIDTH       = 0.075;
const KAREL_LEG_HORIZONTAL_OFFSET = 0.2625;

// Simple Karel proportions
const SIMPLE_KAREL_WIDTH  = 0.8;
const SIMPLE_KAREL_HEIGHT = 0.7;

const DIRECTION_TO_RADIANS = {
  east:  0,
  south: Math.PI / 2,
  west:  Math.PI,
  north: 3 * Math.PI / 2,
};

/**
 * Rotate an array of [x0,y0, x1,y1, ...] coordinates around `center` by `angle` radians.
 * Mutates `points` in place.
 */
function rotatePoints(center, points, angle) {
  if (angle === 0) return;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const [cx, cy] = center;
  for (let i = 0; i < points.length; i += 2) {
    const dx = points[i] - cx, dy = points[i + 1] - cy;
    points[i]     = cx + dx * cos - dy * sin;
    points[i + 1] = cy + dx * sin + dy * cos;
  }
}

function drawPolygon(ctx, points, fill, outline, lineWidth) {
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.closePath();
  if (fill)    { ctx.fillStyle   = fill;      ctx.fill(); }
  if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

function drawKarelBody(ctx, x, y, cs, center, angle) {
  const w = cs * KAREL_WIDTH;
  const h = cs * KAREL_HEIGHT;
  const llDiag = (cs * KAREL_LOWER_LEFT_DIAG) / Math.SQRT2;
  const urDiag = (cs * KAREL_UPPER_RIGHT_DIAG) / Math.SQRT2;

  // Outer body: hexagon with clipped corners (faces east by default)
  const outer = [
    x,               y,
    x + w - urDiag,  y,
    x + w,           y + urDiag,
    x + w,           y + h,
    x + llDiag,      y + h,
    x,               y + h - llDiag,
  ];
  rotatePoints(center, outer, angle);
  drawPolygon(ctx, outer, "white", "black", KAREL_LINE_WIDTH);

  // Inner rectangle (window)
  const ix = x + cs * KAREL_INNER_OFFSET;
  const iy = y + cs * KAREL_INNER_OFFSET;
  const iw = cs * KAREL_INNER_WIDTH;
  const ih = cs * KAREL_INNER_HEIGHT;
  const inner = [ix, iy,  ix + iw, iy,  ix + iw, iy + ih,  ix, iy + ih];
  rotatePoints(center, inner, angle);
  drawPolygon(ctx, inner, "white", "black", KAREL_LINE_WIDTH);

  // Mouth line
  const mx = x + cs * KAREL_MOUTH_HORIZONTAL_OFFSET;
  const my = iy + ih + cs * KAREL_MOUTH_VERTICAL_OFFSET;
  const mouth = [mx, my,  mx + cs * KAREL_MOUTH_WIDTH, my];
  rotatePoints(center, mouth, angle);
  ctx.strokeStyle = "black"; ctx.lineWidth = KAREL_LINE_WIDTH;
  ctx.beginPath();
  ctx.moveTo(mouth[0], mouth[1]);
  ctx.lineTo(mouth[2], mouth[3]);
  ctx.stroke();
}

function drawKarelLegs(ctx, x, y, cs, center, angle) {
  const legLen  = cs * KAREL_LEG_LENGTH;
  const footLen = cs * KAREL_FOOT_LENGTH;
  const footW   = cs * KAREL_LEG_FOOT_WIDTH;
  const vertOff = cs * KAREL_LEG_VERTICAL_OFFSET;
  const horizOff = cs * KAREL_LEG_HORIZONTAL_OFFSET;

  // Left leg (extends to the left, in upper body area)
  const leftLeg = [
    x,                  y + vertOff,
    x - legLen,         y + vertOff,
    x - legLen,         y + vertOff + footLen,
    x - legLen + footW, y + vertOff + footLen,
    x - legLen + footW, y + vertOff + footW,
    x,                  y + vertOff + footW,
  ];
  rotatePoints(center, leftLeg, angle);
  drawPolygon(ctx, leftLeg, "black", "black", 1);

  // Right leg (extends downward from body bottom)
  const bodyBottom = y + cs * KAREL_HEIGHT;
  const rightLeg = [
    x + horizOff,            bodyBottom,
    x + horizOff,            bodyBottom + legLen,
    x + horizOff + footLen,  bodyBottom + legLen,
    x + horizOff + footLen,  bodyBottom + legLen - footW,
    x + horizOff + footW,    bodyBottom + legLen - footW,
    x + horizOff + footW,    bodyBottom,
  ];
  rotatePoints(center, rightLeg, angle);
  drawPolygon(ctx, rightLeg, "black", "black", 1);
}

function drawKarelIcon(ctx, direction, kx, ky, cellSize, icon) {
  const angle  = DIRECTION_TO_RADIANS[direction];
  const center = [kx, ky];

  if (icon === "simple") {
    const w = cellSize * SIMPLE_KAREL_WIDTH;
    const h = cellSize * SIMPLE_KAREL_HEIGHT;
    const pts = [
      kx - w / 2, ky - h / 2,
      kx - w / 2, ky + h / 2,
      kx,         ky + h / 2,
      kx + w / 2, ky,
      kx,         ky - h / 2,
    ];
    rotatePoints(center, pts, angle);
    drawPolygon(ctx, pts, "white", "black", KAREL_LINE_WIDTH);
  } else {
    // Full Karel body (default)
    const ox = kx - cellSize / 2 + KAREL_LEFT_HORIZONTAL_PAD * cellSize;
    const oy = ky - cellSize / 2 + KAREL_VERTICAL_OFFSET * cellSize;
    drawKarelBody(ctx, ox, oy, cellSize, center, angle);
    drawKarelLegs(ctx, ox, oy, cellSize, center, angle);
  }
}

/**
 * Draw a red X centered on (cx, cy) to mark the spot of an illegal action
 * (hitting a wall, or an empty-handed put/pick). Drawn on top of Karel.
 */
function drawErrorMarker(ctx, cx, cy, cellSize) {
  const r = cellSize * 0.35;
  ctx.save();
  ctx.strokeStyle = "red";
  ctx.lineWidth = Math.max(3, cellSize * 0.08);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r);
  ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r);
  ctx.stroke();
  ctx.restore();
}

/**
 * Render the current state of the world + Karel to a canvas element.
 * @param {KarelWorld} world
 * @param {KarelProgram} karel
 * @param {number} cellSize  Pixels per cell
 * @param {string} icon      "karel" (default) or "simple"
 * @param {boolean} [errorMark=false]  Draw a red X on Karel's corner to mark
 *   an illegal action (wall collision, empty-bag put, no-beeper pick).
 * @returns {HTMLCanvasElement}
 */
function renderFrame(world, karel, cellSize, icon = "karel", errorMark = false) {
  const imgW  = 2 * BORDER_OFFSET + world.numAvenues * cellSize;
  const imgH  = 2 * BORDER_OFFSET + world.numStreets * cellSize;
  const leftX = BORDER_OFFSET;
  const topY  = BORDER_OFFSET;

  // Pixel centre of cell (avenue, street)
  const cornerX = a => leftX + cellSize / 2 + (a - 1) * cellSize;
  const cornerY = s => topY  + cellSize / 2 + (world.numStreets - s) * cellSize;

  const canvas = document.createElement("canvas");
  canvas.width  = imgW;
  canvas.height = imgH;
  const ctx = canvas.getContext("2d");

  // ── Background ───────────────────────────────────────────────────────────
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, imgW, imgH);

  // ── Colored corners (fill whole cell) ────────────────────────────────────
  for (const [key, color] of world.cornerColors) {
    const [a, s] = key.split(",").map(Number);
    ctx.fillStyle = CSS_COLORS[color] ?? color;
    ctx.fillRect(cornerX(a) - cellSize / 2, cornerY(s) - cellSize / 2, cellSize, cellSize);
  }

  // ── Corner crosshairs (uncolored corners only) ────────────────────────────
  ctx.strokeStyle = "black";
  ctx.lineWidth = 1;
  for (let a = 1; a <= world.numAvenues; a++) {
    for (let s = 1; s <= world.numStreets; s++) {
      if (!world.cornerColors.has(`${a},${s}`)) {
        const cx = cornerX(a), cy = cornerY(s);
        ctx.beginPath(); ctx.moveTo(cx, cy - CORNER_SIZE); ctx.lineTo(cx, cy + CORNER_SIZE); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - CORNER_SIZE, cy); ctx.lineTo(cx + CORNER_SIZE, cy); ctx.stroke();
      }
    }
  }

  // ── Beepers ───────────────────────────────────────────────────────────────
  for (const [key, count] of world.beepers) {
    if (count === 0) continue;
    const [a, s] = key.split(",").map(Number);
    const cx = cornerX(a), cy = cornerY(s);
    const r = cellSize * BEEPER_CELL_SIZE_FRAC;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fillStyle = "lightgrey"; ctx.fill();
    ctx.strokeStyle = "black"; ctx.lineWidth = 1; ctx.stroke();
    if (count > 1) {
      ctx.fillStyle = "black";
      ctx.font = `${Math.max(9, Math.round(cellSize * 0.28))}px Arial`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(count), cx, cy);
    }
  }

  // ── Walls ─────────────────────────────────────────────────────────────────
  ctx.strokeStyle = "black";
  ctx.lineWidth = LINE_WIDTH;
  for (const wallKey of world.walls) {
    const parts = wallKey.split(",");
    const a = parseInt(parts[0]), s = parseInt(parts[1]), dir = parts[2];
    const cx = cornerX(a), cy = cornerY(s);
    const half = cellSize / 2;
    ctx.beginPath();
    if      (dir === "north") { ctx.moveTo(cx - half, cy - half); ctx.lineTo(cx + half, cy - half); }
    else if (dir === "south") { ctx.moveTo(cx - half, cy + half); ctx.lineTo(cx + half, cy + half); }
    else if (dir === "east")  { ctx.moveTo(cx + half, cy - half); ctx.lineTo(cx + half, cy + half); }
    else if (dir === "west")  { ctx.moveTo(cx - half, cy - half); ctx.lineTo(cx - half, cy + half); }
    ctx.stroke();
  }

  // ── Bounding rectangle ────────────────────────────────────────────────────
  ctx.strokeStyle = "black";
  ctx.lineWidth = LINE_WIDTH;
  ctx.strokeRect(leftX, topY, world.numAvenues * cellSize, world.numStreets * cellSize);

  // ── Axis labels ───────────────────────────────────────────────────────────
  const bottomEdge = topY + world.numStreets * cellSize;
  ctx.fillStyle = "black";
  ctx.font = "10px Arial";
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  for (let a = 1; a <= world.numAvenues; a++) {
    ctx.fillText(String(a), cornerX(a), bottomEdge + LABEL_OFFSET);
  }
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (let s = 1; s <= world.numStreets; s++) {
    ctx.fillText(String(s), leftX - LABEL_OFFSET, cornerY(s));
  }

  // ── Karel robot ───────────────────────────────────────────────────────────
  drawKarelIcon(ctx, karel.direction, cornerX(karel.avenue), cornerY(karel.street), cellSize, icon);

  // ── Illegal-action marker ─────────────────────────────────────────────────
  if (errorMark) {
    drawErrorMarker(ctx, cornerX(karel.avenue), cornerY(karel.street), cellSize);
  }

  return canvas;
}

// ─────────────────────────── GIF.JS LOADER ──────────────────────────────────

// gif.js consists of two runtime artifacts that must be loaded separately:
//   • The main module  — runs on the main thread, loaded via ESM import.
//   • The worker script — runs inside a Worker; the browser requires a
//     separate script URL for it and cannot reuse the module import.
//
// Both URLs are derived from the single version constant below so that a
// version bump requires exactly one change. The worker Blob is cached so
// subsequent runKarel() calls don't re-fetch it from the network.

let _gifDeps = null;

/**
 * Load both gif.js artifacts in parallel and cache them.
 * - Module:  loaded via ESM dynamic import from esm.sh (no eval, no
 *   Observable-specific require, works under strict CSP).
 * - Worker:  raw script fetched from jsDelivr and stored as a Blob so a
 *   fresh object URL can be created per GIF (required because gif.js
 *   revokes the URL after the worker pool is torn down).
 * When bundled with webpack/Vite/esbuild the gif.js dependency in
 * package.json is resolved from node_modules instead of the network.
 * @returns {{ GIF: Function, workerBlob: Blob }}
 */
async function loadGifDeps() {
  if (_gifDeps) return _gifDeps;
  const VERSION = "0.2.0";
  const [mod, workerBlob] = await Promise.all([
    import(`https://esm.sh/gif.js@${VERSION}`),
    fetch(`https://cdn.jsdelivr.net/npm/gif.js@${VERSION}/dist/gif.worker.js`).then(r => r.blob()),
  ]);
  _gifDeps = { GIF: mod.default ?? mod, workerBlob };
  return _gifDeps;
}

// ─────────────────────────── MAIN API ───────────────────────────────────────

/**
 * Run a Karel program and return a Promise that resolves to an animated <img>.
 *
 * @param {string} worldText   World file contents (same format as .w files)
 * @param {Function} mainFunc  Program to run. Receives a KarelProgram instance
 *                             (or its destructured methods). May be async.
 * @param {object} [options]
 * @param {number} [options.cellSize=50]          Pixels per grid cell
 * @param {number} [options.delay]                Milliseconds per frame in GIF.
 *   Defaults to the world's `Speed:` directive if present (Speed 1.0 → 100 ms,
 *   Speed 2.0 → 50 ms, Speed 0.5 → 200 ms), otherwise 100 ms.
 * @param {number} [options.finalFrameDelay=1000] Extra pause on the last frame
 * @param {number} [options.gifWorkers=2]         Web workers for gif.js
 * @param {"karel"|"simple"} [options.icon="karel"]  Robot icon style
 * @returns {Promise<HTMLImageElement>} Resolves with the animated GIF image.
 *   If the Karel program throws (e.g. hitting a wall), the promise still
 *   resolves with the partial animation; a final frame marks the offending
 *   corner with a red X, and the error message is available on
 *   `img.dataset.error` and as the element's tooltip (`img.title`).
 */
export async function runKarel(worldText, mainFunc, options = {}) {
  // Build world first so Speed: directive is available for the delay default.
  const world = new KarelWorld();
  world.loadFromText(worldText);

  const {
    cellSize        = 50,
    delay           = world.karelSpeed != null ? Math.round(100 / world.karelSpeed) : 100,
    finalFrameDelay = 1000,
    gifWorkers      = 2,
    icon            = "karel",
  } = options;

  const karel = new KarelProgram(world);

  // Collect one canvas frame per action (plus initial state)
  const frames = [];
  const capture = () => frames.push(renderFrame(world, karel, cellSize, icon));

  capture();                        // frame 0: initial state
  karel._callbacks.push(capture);   // frame N: after each action

  // Execute the program (supports sync and async main functions).
  // Errors (e.g. Karel hitting a wall) are caught so the partial animation is
  // still rendered; the error is surfaced on the returned <img> element.
  let programError = null;
  try {
    await mainFunc(karel);
  } catch (err) {
    programError = err;
    // Karel's pose is unchanged by a failed action (move throws before it
    // steps; put/pick throw before touching beepers), so its current corner
    // is the point of the error. Add a final frame marking it with a red X.
    frames.push(renderFrame(world, karel, cellSize, icon, true));
  }

  const { GIF, workerBlob } = await loadGifDeps();
  const workerUrl = URL.createObjectURL(workerBlob);

  const { width, height } = frames[0];
  const gif = new GIF({ workers: gifWorkers, quality: 10, width, height, workerScript: workerUrl });

  for (const frame of frames) {
    gif.addFrame(frame.getContext("2d"), { copy: true, delay });
  }
  // Hold on the final frame longer so the viewer can see the end state
  gif.addFrame(
    frames[frames.length - 1].getContext("2d"),
    { copy: true, delay: finalFrameDelay }
  );

  return new Promise((resolve, reject) => {
    gif.on("finished", (blob) => {
      URL.revokeObjectURL(workerUrl);
      const img = document.createElement("img");
      img.src = URL.createObjectURL(blob);
      if (programError) {
        img.dataset.error = programError.message;
        img.title = `Karel error: ${programError.message}`;
      }
      resolve(img);
    });
    gif.on("error", reject);
    gif.render();
  });
}

/**
 * Fetch a world file from a URL and return its text.
 * Convenience helper for loading .w files hosted online.
 *
 * @param {string} url
 * @returns {Promise<string>}
 */
export async function fetchWorld(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch world: ${res.status} ${res.statusText}`);
  return res.text();
}
