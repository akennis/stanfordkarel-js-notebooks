/**
 * gen-lesson-assignments.js — author/generate the per-lesson assignment manifests.
 *
 * The course has one lesson per topic (lessons/NN-*.html); this script is the
 * single re-derivable SOURCE OF TRUTH for the matching assignments. It holds
 * every problem's PLAINTEXT reference solution, verifies each one headlessly with
 * gradeKarel (the solution must run cleanly and match itself; the starter must
 * NOT already solve), seals the solution (tools/seal.js cipher), and writes
 * assignments/lesson-NN.js — a manifest whose solutions ship SEALED, never in
 * plaintext (see CLAUDE.md → "Adding an assignment").
 *
 * Regenerate after editing any problem below:
 *   node tools/gen-lesson-assignments.js
 * Add --check to only verify (no files written).
 *
 * Each lesson manifest holds three problems keyed simple | moderate | complex
 * (a lesson may add a further problem under its own key, e.g. complex2).
 * The student page (assignments/assignment.html) renders them all plus one
 * combined, auto-framed submission textarea; the teacher grader
 * (tools/grade-lessons.js) re-runs each framed problem against these solutions.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";
import { sealSolution, gradeKarel, compileProgram } from "../stanfordkarel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// A small stub used as the default empty editor for pure-Karel problems.
const STUB = "function main(k) {\n  \n}\n";

// ─────────────────────────── PROBLEM DATA ───────────────────────────────────
// LESSONS[n] = { slug, title, problems: [simple, moderate, complex] }
// Each problem: { key, label, points, world, prompt, starter, check, end?, solution }
// `solution` is PLAINTEXT here; it is sealed on the way out.

const P = "Put"; // (kept readable below)

const LESSONS = {
  1: {
    slug: "01-commands", title: "Commands & Sequencing",
    problems: [
      {
        key: "simple", label: "Simple", points: 5,
        world: `Dimension: (5, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Karel starts at the west end of a 5-corner corridor. Walk east until Karel stands on the last corner <code>(5, 1)</code>.`,
        starter: STUB, check: ["position"],
        solution: `function main(k) {\n  k.move();\n  k.move();\n  k.move();\n  k.move();\n}`,
      },
      {
        key: "moderate", label: "Moderate", points: 10,
        world: `Dimension: (4, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Drop a beeper on the <strong>first</strong> corner, walk east to corner <code>(4, 1)</code>, and drop a beeper there too.`,
        starter: STUB, check: ["beepers", "position"],
        solution: `function main(k) {\n  k.putBeeper();\n  k.move();\n  k.move();\n  k.move();\n  k.putBeeper();\n}`,
      },
      {
        key: "complex", label: "Complex", points: 15,
        world: `Dimension: (3, 3)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Walk east to the far wall, turn to face north, walk up to the top-right corner <code>(3, 3)</code>, and drop a single beeper there. Karel should finish facing north.`,
        starter: STUB, check: ["beepers", "position", "direction"],
        solution: `function main(k) {\n  k.move();\n  k.move();\n  k.turnLeft();\n  k.move();\n  k.move();\n  k.putBeeper();\n}`,
      },
    ],
  },

  2: {
    slug: "02-functions", title: "Functions",
    problems: [
      {
        key: "simple", label: "Simple", points: 5,
        world: `Dimension: (3, 3)\nKarel: (2, 2); north\nBeeperBag: INFINITY`,
        prompt: `Karel has no built-in "turn right". Write a helper <code>turnRight(k)</code> (three left turns), use it to face east, then move one square to <code>(3, 2)</code>.`,
        starter: `function turnRight(k) {\n  \n}\n\nfunction main(k) {\n  \n}\n`,
        check: ["position", "direction"],
        solution: `function turnRight(k) {\n  k.turnLeft();\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction main(k) {\n  turnRight(k);\n  k.move();\n}`,
      },
      {
        key: "moderate", label: "Moderate", points: 10,
        world: `Dimension: (5, 1)\nKarel: (3, 1); east\nBeeperBag: INFINITY`,
        prompt: `Write a helper <code>turnAround(k)</code> (two left turns). Move east to the wall, turn around, and walk all the way back to <code>(1, 1)</code> facing west.`,
        starter: `function turnAround(k) {\n  \n}\n\nfunction main(k) {\n  \n}\n`,
        check: ["position", "direction"],
        solution: `function turnAround(k) {\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction main(k) {\n  k.move();\n  k.move();\n  turnAround(k);\n  k.move();\n  k.move();\n  k.move();\n  k.move();\n}`,
      },
      {
        key: "complex", label: "Complex", points: 15,
        world: `Dimension: (4, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Write a helper <code>dropAndMove(k)</code> that drops a beeper and then moves one square east. Call it three times to leave beepers on corners 1, 2, and 3, finishing on <code>(4, 1)</code>.`,
        starter: `function dropAndMove(k) {\n  \n}\n\nfunction main(k) {\n  \n}\n`,
        check: ["beepers", "position"],
        solution: `function dropAndMove(k) {\n  k.putBeeper();\n  k.move();\n}\n\nfunction main(k) {\n  dropAndMove(k);\n  dropAndMove(k);\n  dropAndMove(k);\n}`,
      },
      {
        key: "complex2", label: "Complex II", points: 20,
        world: `Dimension: (8, 8)\nKarel: (1, 1); east\nBeeperBag: 0\nWall: (2, 2); north\nWall: (3, 2); north\nWall: (4, 2); north\nWall: (5, 2); north\nWall: (6, 2); north\nWall: (2, 4); north\nWall: (3, 4); north\nWall: (4, 4); north\nWall: (5, 4); north\nWall: (6, 4); north\nWall: (2, 6); north\nWall: (3, 6); north\nWall: (4, 6); north\nWall: (5, 6); north\nWall: (6, 6); north\nBeeper: (2, 3); 1\nBeeper: (4, 3); 1\nBeeper: (6, 3); 1\nBeeper: (2, 5); 1\nBeeper: (4, 5); 1\nBeeper: (6, 5); 1\nBeeper: (2, 7); 1\nBeeper: (4, 7); 1\nBeeper: (6, 7); 1`,
        prompt: `Nine beepers are scattered across the three floors of an 8&times;8 building &mdash; streets 3, 5 and 7, with a beeper on avenues 2, 4 and 6 of each. Walls seal the middle of every floor, so the only ways up are the open columns at the far west (avenue 1) and far east (avenues 7&ndash;8).\n<p>Every floor is laid out exactly the same, which is what makes this a job for a <strong>function</strong>. Write a helper of your own that picks up all the beepers on <em>one</em> floor, then call it once per floor to clear the whole building. You may write a second helper for the trip up to the next floor.</p>\n<p>You don't have <code>if</code> or loops yet, so spell the moves out inside the helper &mdash; let the helper do the repeating. Karel starts at <code>(1, 1)</code> facing east with an empty bag and must finish holding all nine beepers; where Karel ends up doesn't matter.</p>`,
        starter: STUB, check: ["beepers"],
        solution: `function clearFloor(k) {\n  k.move();\n  k.pickBeeper();\n  k.move();\n  k.move();\n  k.pickBeeper();\n  k.move();\n  k.move();\n  k.pickBeeper();\n}\n\nfunction climb(k) {\n  k.move();\n  k.move();\n  k.turnLeft();\n  k.move();\n  k.move();\n  k.turnLeft();\n  k.move();\n  k.move();\n  k.move();\n  k.move();\n  k.move();\n  k.move();\n  k.move();\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction main(k) {\n  k.turnLeft();\n  k.move();\n  k.move();\n  k.turnLeft();\n  k.turnLeft();\n  k.turnLeft();\n  clearFloor(k);\n  climb(k);\n  clearFloor(k);\n  climb(k);\n  clearFloor(k);\n}`,
      },
    ],
  },

  3: {
    slug: "03-if", title: "Making Decisions with if",
    problems: [
      {
        key: "simple", label: "Simple", points: 5,
        world: `Dimension: (1, 1)\nKarel: (1, 1); east\nBeeperBag: 0\nBeeper: (1, 1); 1`,
        prompt: `There may or may not be a beeper here. Using a single <code>if</code>, pick the beeper up <strong>only if</strong> one is present.`,
        starter: STUB, check: ["beepers"],
        solution: `function main(k) {\n  if (k.beepersPresent()) {\n    k.pickBeeper();\n  }\n}`,
      },
      {
        key: "moderate", label: "Moderate", points: 10,
        world: `Dimension: (3, 1)\nKarel: (1, 1); east\nBeeperBag: 0\nBeeper: (1, 1); 1\nBeeper: (3, 1); 1`,
        prompt: `Some corners have a beeper, some don't. Visit all three corners in a row (no loop yet — write it out). At each corner, pick a beeper up only if one is present.`,
        starter: STUB, check: ["beepers", "position"],
        solution: `function main(k) {\n  if (k.beepersPresent()) k.pickBeeper();\n  k.move();\n  if (k.beepersPresent()) k.pickBeeper();\n  k.move();\n  if (k.beepersPresent()) k.pickBeeper();\n}`,
      },
      {
        key: "complex", label: "Complex", points: 15,
        world: `Dimension: (4, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY\nBeeper: (2, 1); 1\nBeeper: (4, 1); 1`,
        prompt: `Walk across all four corners. Whenever the current corner has a beeper, paint it <code>"Red"</code>. Leave the beepers where they are.`,
        starter: STUB, check: ["colors", "position"],
        solution: `function main(k) {\n  if (k.beepersPresent()) k.paintCorner("Red");\n  k.move();\n  if (k.beepersPresent()) k.paintCorner("Red");\n  k.move();\n  if (k.beepersPresent()) k.paintCorner("Red");\n  k.move();\n  if (k.beepersPresent()) k.paintCorner("Red");\n}`,
      },
      {
        key: "complex2", label: "Complex II", points: 20,
        world: `Dimension: (8, 8)\nKarel: (1, 1); east\nBeeperBag: INFINITY\nColor: (6, 1); Blue\nColor: (2, 2); Red\nColor: (4, 3); Red\nColor: (6, 3); Orange\nColor: (8, 4); Blue\nColor: (2, 5); Orange\nColor: (4, 5); Blue\nColor: (6, 5); Red\nColor: (2, 7); Red\nColor: (7, 7); Orange\nColor: (4, 8); Blue\nColor: (8, 8); Orange`,
        prompt: `An 8&times;8 grid is dusted with coloured corners &mdash; some <code>"Red"</code>, some <code>"Orange"</code>, some <code>"Blue"</code>, the rest bare. Karel must sweep the whole grid and leave beepers to match the colour it is standing on: <strong>1</strong> beeper on every red corner, <strong>2</strong> on every orange corner, <strong>3</strong> on every blue corner, and nothing on a bare corner.\n<p>You don't have loops yet, so this is a job for <strong>functions</strong> plus <code>if</code>. Write a helper that checks the current corner's colour with <code>cornerColorIs</code> and drops the right number of beepers, and another helper that walks one full row of eight corners applying it; then call them to cover the grid boustrophedon-style &mdash; east along one street, up one, west along the next.</p>\n<p>Karel starts at <code>(1, 1)</code> facing east with an unlimited bag. Where Karel finishes doesn't matter &mdash; only the beepers are graded.</p>`,
        starter: STUB, check: ["beepers"],
        solution: `function turnRight(k) {\n  k.turnLeft();\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction mark(k) {\n  if (k.cornerColorIs("Red")) {\n    k.putBeeper();\n  }\n  if (k.cornerColorIs("Orange")) {\n    k.putBeeper();\n    k.putBeeper();\n  }\n  if (k.cornerColorIs("Blue")) {\n    k.putBeeper();\n    k.putBeeper();\n    k.putBeeper();\n  }\n}\n\nfunction crossRow(k) {\n  mark(k);\n  k.move();\n  mark(k);\n  k.move();\n  mark(k);\n  k.move();\n  mark(k);\n  k.move();\n  mark(k);\n  k.move();\n  mark(k);\n  k.move();\n  mark(k);\n  k.move();\n  mark(k);\n}\n\nfunction hopFromEast(k) {\n  k.turnLeft();\n  k.move();\n  k.turnLeft();\n}\n\nfunction hopFromWest(k) {\n  turnRight(k);\n  k.move();\n  turnRight(k);\n}\n\nfunction main(k) {\n  crossRow(k);\n  hopFromEast(k);\n  crossRow(k);\n  hopFromWest(k);\n  crossRow(k);\n  hopFromEast(k);\n  crossRow(k);\n  hopFromWest(k);\n  crossRow(k);\n  hopFromEast(k);\n  crossRow(k);\n  hopFromWest(k);\n  crossRow(k);\n  hopFromEast(k);\n  crossRow(k);\n}`,
      },
    ],
  },

  4: {
    slug: "04-for-loops", title: "The for Loop",
    problems: [
      {
        key: "simple", label: "Simple", points: 5,
        world: `Dimension: (6, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Use a <code>for</code> loop to move east five times, ending on <code>(6, 1)</code>.`,
        starter: STUB, check: ["position"],
        solution: `function main(k) {\n  for (let i = 0; i < 5; i++) {\n    k.move();\n  }\n}`,
      },
      {
        key: "moderate", label: "Moderate", points: 10,
        world: `Dimension: (4, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Use a <code>for</code> loop to drop a beeper on every one of the four corners, finishing on <code>(4, 1)</code>.`,
        starter: STUB, check: ["beepers", "position"],
        solution: `function main(k) {\n  for (let i = 0; i < 3; i++) {\n    k.putBeeper();\n    k.move();\n  }\n  k.putBeeper();\n}`,
      },
      {
        key: "complex", label: "Complex", points: 15,
        world: `Dimension: (5, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Drop a beeper on all five corners, then turn around and return to <code>(1, 1)</code>, finishing there facing west.`,
        starter: STUB, check: ["beepers", "position", "direction"],
        solution: `function main(k) {\n  for (let i = 0; i < 4; i++) {\n    k.putBeeper();\n    k.move();\n  }\n  k.putBeeper();\n  k.turnLeft();\n  k.turnLeft();\n  for (let i = 0; i < 4; i++) {\n    k.move();\n  }\n}`,
      },
    ],
  },

  5: {
    slug: "05-while-loops", title: "The while Loop",
    problems: [
      {
        key: "simple", label: "Simple", points: 5,
        world: `Dimension: (7, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Karel doesn't know how long the corridor is. Use a <code>while</code> loop to move east until the front is blocked, stopping at the far wall.`,
        starter: STUB, check: ["position"],
        solution: `function main(k) {\n  while (k.frontIsClear()) {\n    k.move();\n  }\n}`,
      },
      {
        key: "moderate", label: "Moderate", points: 10,
        world: `Dimension: (1, 1)\nKarel: (1, 1); east\nBeeperBag: 0\nBeeper: (1, 1); 5`,
        prompt: `There is a pile of beepers on Karel's corner. Use a <code>while</code> loop to pick them <strong>all</strong> up.`,
        starter: STUB, check: ["beepers"],
        solution: `function main(k) {\n  while (k.beepersPresent()) {\n    k.pickBeeper();\n  }\n}`,
      },
      {
        key: "complex", label: "Complex", points: 15,
        world: `Dimension: (6, 1)\nKarel: (1, 1); east\nBeeperBag: 0\nBeeper: (1, 1); 1\nBeeper: (2, 1); 1\nBeeper: (3, 1); 1\nBeeper: (4, 1); 1\nBeeper: (5, 1); 1\nBeeper: (6, 1); 1`,
        prompt: `Every corner holds a beeper. Walk east to the wall, collecting <strong>every</strong> beeper along the way, and stop on the last corner.`,
        starter: STUB, check: ["beepers", "position"],
        solution: `function main(k) {\n  while (true) {\n    while (k.beepersPresent()) k.pickBeeper();\n    if (!k.frontIsClear()) break;\n    k.move();\n  }\n}`,
      },
    ],
  },

  6: {
    slug: "06-if-else", title: "if / else",
    problems: [
      {
        key: "simple", label: "Simple", points: 5,
        world: `Dimension: (1, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Using <code>if</code> / <code>else</code>: if a beeper is present, pick it up; otherwise, put one down. (This corner is empty, so Karel should leave a beeper.)`,
        starter: STUB, check: ["beepers"],
        solution: `function main(k) {\n  if (k.beepersPresent()) {\n    k.pickBeeper();\n  } else {\n    k.putBeeper();\n  }\n}`,
      },
      {
        key: "moderate", label: "Moderate", points: 10,
        world: `Dimension: (5, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY\nBeeper: (1, 1); 1\nBeeper: (3, 1); 1\nBeeper: (5, 1); 1`,
        prompt: `Flip every corner in the row: at each of the five corners, if a beeper is present pick it up, otherwise put one down. Finish on <code>(5, 1)</code>.`,
        starter: STUB, check: ["beepers", "position"],
        solution: `function main(k) {\n  for (let i = 0; i < 4; i++) {\n    if (k.beepersPresent()) k.pickBeeper();\n    else k.putBeeper();\n    k.move();\n  }\n  if (k.beepersPresent()) k.pickBeeper();\n  else k.putBeeper();\n}`,
      },
      {
        key: "complex", label: "Complex", points: 15,
        world: `Dimension: (4, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY\nBeeper: (2, 1); 1\nBeeper: (4, 1); 1`,
        prompt: `Walk across all four corners. At each one, paint it <code>"Blue"</code> if it has a beeper, and <code>"Red"</code> if it doesn't.`,
        starter: STUB, check: ["colors", "position"],
        solution: `function main(k) {\n  for (let i = 0; i < 3; i++) {\n    if (k.beepersPresent()) k.paintCorner("Blue");\n    else k.paintCorner("Red");\n    k.move();\n  }\n  if (k.beepersPresent()) k.paintCorner("Blue");\n  else k.paintCorner("Red");\n}`,
      },
    ],
  },

  7: {
    slug: "07-parameters", title: "Parameters",
    problems: [
      {
        key: "simple", label: "Simple", points: 5,
        world: `Dimension: (5, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Write <code>moveN(k, n)</code> that moves Karel <code>n</code> squares. Call <code>moveN(k, 4)</code> to reach <code>(5, 1)</code>.`,
        starter: `function moveN(k, n) {\n  \n}\n\nfunction main(k) {\n  \n}\n`,
        check: ["position"],
        solution: `function moveN(k, n) {\n  for (let i = 0; i < n; i++) k.move();\n}\n\nfunction main(k) {\n  moveN(k, 4);\n}`,
      },
      {
        key: "moderate", label: "Moderate", points: 10,
        world: `Dimension: (1, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Write <code>putN(k, n)</code> that drops <code>n</code> beepers on the current corner. Call <code>putN(k, 5)</code>.`,
        starter: `function putN(k, n) {\n  \n}\n\nfunction main(k) {\n  \n}\n`,
        check: ["beepers"],
        solution: `function putN(k, n) {\n  for (let i = 0; i < n; i++) k.putBeeper();\n}\n\nfunction main(k) {\n  putN(k, 5);\n}`,
      },
      {
        key: "complex", label: "Complex", points: 15,
        world: `Dimension: (4, 4)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Reuse <code>moveN(k, n)</code> to draw an L: move 3 east to <code>(4, 1)</code>, turn to face north, move 3 up to <code>(4, 4)</code>, and drop a beeper. Finish facing north.`,
        starter: `function moveN(k, n) {\n  \n}\n\nfunction main(k) {\n  \n}\n`,
        check: ["beepers", "position", "direction"],
        solution: `function moveN(k, n) {\n  for (let i = 0; i < n; i++) k.move();\n}\n\nfunction main(k) {\n  moveN(k, 3);\n  k.turnLeft();\n  moveN(k, 3);\n  k.putBeeper();\n}`,
      },
    ],
  },

  8: {
    slug: "08-variables", title: "Variables",
    problems: [
      {
        key: "simple", label: "Simple", points: 5,
        world: `Dimension: (5, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Store the number of steps in a variable — <code>let steps = 4;</code> — then use it to move that many times, ending on <code>(5, 1)</code>.`,
        starter: `function main(k) {\n  let steps = 4;\n  \n}\n`,
        check: ["position"],
        solution: `function main(k) {\n  let steps = 4;\n  for (let i = 0; i < steps; i++) k.move();\n}`,
      },
      {
        key: "moderate", label: "Moderate", points: 10,
        world: `Dimension: (4, 1)\nKarel: (1, 1); east\nBeeperBag: 0\nBeeper: (1, 1); 1\nBeeper: (2, 1); 1\nBeeper: (3, 1); 1`,
        prompt: `Keep a running <code>count</code> in a variable. Walk east across all four corners, picking up each beeper and counting it. On the last corner, drop that many beepers back down.`,
        starter: `function main(k) {\n  let count = 0;\n  \n}\n`,
        check: ["beepers", "position"],
        solution: `function main(k) {\n  let count = 0;\n  for (let i = 0; i < 3; i++) {\n    if (k.beepersPresent()) { k.pickBeeper(); count++; }\n    k.move();\n  }\n  if (k.beepersPresent()) { k.pickBeeper(); count++; }\n  for (let i = 0; i < count; i++) k.putBeeper();\n}`,
      },
      {
        key: "complex", label: "Complex", points: 15,
        world: `Dimension: (4, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Build a growing staircase of beepers: put 1 beeper on corner 1, 2 on corner 2, 3 on corner 3, and 4 on corner 4. Use a counter variable for how many to drop.`,
        starter: STUB, check: ["beepers", "position"],
        solution: `function main(k) {\n  for (let i = 1; i <= 4; i++) {\n    for (let j = 0; j < i; j++) k.putBeeper();\n    if (i < 4) k.move();\n  }\n}`,
      },
    ],
  },

  9: {
    slug: "09-booleans-return", title: "Return Values & Logic",
    problems: [
      {
        key: "simple", label: "Simple", points: 5,
        world: `Dimension: (1, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY\nBeeper: (1, 1); 1`,
        prompt: `Write a boolean-returning helper <code>hasBeeper(k)</code> that returns whether a beeper is present. Use it in an <code>if</code> to pick the beeper up.`,
        starter: `function hasBeeper(k) {\n  \n}\n\nfunction main(k) {\n  \n}\n`,
        check: ["beepers"],
        solution: `function hasBeeper(k) {\n  return k.beepersPresent();\n}\n\nfunction main(k) {\n  if (hasBeeper(k)) k.pickBeeper();\n}`,
      },
      {
        key: "moderate", label: "Moderate", points: 10,
        world: `Dimension: (3, 1)\nKarel: (1, 1); east\nBeeperBag: 0\nBeeper: (1, 1); 1\nBeeper: (2, 1); 1`,
        prompt: `Use the logical AND (<code>&&</code>): keep picking and moving <strong>while the front is clear AND a beeper is present</strong>. Karel should stop when either becomes false.`,
        starter: STUB, check: ["beepers", "position"],
        solution: `function main(k) {\n  while (k.frontIsClear() && k.beepersPresent()) {\n    k.pickBeeper();\n    k.move();\n  }\n}`,
      },
      {
        key: "complex", label: "Complex", points: 15,
        world: `Dimension: (4, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY\nBeeper: (2, 1); 1`,
        prompt: `Write <code>shouldPaint(k)</code> returning <code>true</code> when the corner has a beeper <strong>OR</strong> is the last corner (front blocked). Walk all four corners and paint <code>"Green"</code> wherever it returns true.`,
        starter: `function shouldPaint(k) {\n  \n}\n\nfunction main(k) {\n  \n}\n`,
        check: ["colors", "position"],
        solution: `function shouldPaint(k) {\n  return k.beepersPresent() || !k.frontIsClear();\n}\n\nfunction main(k) {\n  for (let i = 0; i < 3; i++) {\n    if (shouldPaint(k)) k.paintCorner("Green");\n    k.move();\n  }\n  if (shouldPaint(k)) k.paintCorner("Green");\n}`,
      },
    ],
  },

  10: {
    slug: "10-capstone", title: "Putting It All Together",
    problems: [
      {
        key: "simple", label: "Simple", points: 5,
        world: `Dimension: (4, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Warm-up: fill the whole row — drop a beeper on all four corners.`,
        starter: STUB, check: ["beepers", "position"],
        solution: `function main(k) {\n  for (let i = 0; i < 3; i++) {\n    k.putBeeper();\n    k.move();\n  }\n  k.putBeeper();\n}`,
      },
      {
        key: "moderate", label: "Moderate", points: 10,
        world: `Dimension: (3, 3)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Fill the entire 3×3 grid with beepers, one on every corner. Sweep the rows in a snake (boustrophedon) pattern so you never waste moves.`,
        starter: `function turnRight(k) {\n  k.turnLeft();\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction main(k) {\n  \n}\n`,
        check: ["beepers"],
        solution: `function turnRight(k) {\n  k.turnLeft();\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction main(k) {\n  for (let row = 0; row < 3; row++) {\n    for (let i = 0; i < 3; i++) {\n      k.putBeeper();\n      if (i < 2) k.move();\n    }\n    if (row < 2) {\n      if (k.facingEast()) { k.turnLeft(); k.move(); k.turnLeft(); }\n      else { turnRight(k); k.move(); turnRight(k); }\n    }\n  }\n}`,
      },
      {
        key: "complex", label: "Complex", points: 15,
        world: `Dimension: (4, 4)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Climb the diagonal: drop a beeper on <code>(1, 1)</code>, <code>(2, 2)</code>, <code>(3, 3)</code>, and <code>(4, 4)</code>, using a step of "east one, north one" between drops.`,
        starter: `function turnRight(k) {\n  k.turnLeft();\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction main(k) {\n  \n}\n`,
        check: ["beepers", "position"],
        solution: `function turnRight(k) {\n  k.turnLeft();\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction main(k) {\n  for (let i = 0; i < 4; i++) {\n    k.putBeeper();\n    if (i < 3) {\n      k.move();\n      k.turnLeft();\n      k.move();\n      turnRight(k);\n    }\n  }\n}`,
      },
    ],
  },

  11: {
    slug: "11-numbers-operators", title: "Numbers & Operators",
    problems: [
      {
        key: "simple", label: "Simple", points: 5,
        world: `Dimension: (1, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Compute <code>2 + 3</code>, store it in a variable, and drop that many beepers on the corner.`,
        starter: `function main(k) {\n  const n = 2 + 3;\n  \n}\n`,
        check: ["beepers"],
        solution: `function main(k) {\n  const n = 2 + 3;\n  for (let i = 0; i < n; i++) k.putBeeper();\n}`,
      },
      {
        key: "moderate", label: "Moderate", points: 10,
        world: `Dimension: (7, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Compute <code>2 * 3</code> and move Karel that many squares east, ending on <code>(7, 1)</code>.`,
        starter: `function main(k) {\n  const steps = 2 * 3;\n  \n}\n`,
        check: ["position"],
        solution: `function main(k) {\n  const steps = 2 * 3;\n  for (let i = 0; i < steps; i++) k.move();\n}`,
      },
      {
        key: "complex", label: "Complex", points: 15,
        world: `Dimension: (6, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Use the remainder operator <code>%</code>: walk all six corners and paint the even-numbered ones (corner 2, 4, 6) <code>"Red"</code>. Corner numbers are 1-based.`,
        starter: STUB, check: ["colors", "position"],
        solution: `function main(k) {\n  for (let i = 1; i <= 6; i++) {\n    if (i % 2 === 0) k.paintCorner("Red");\n    if (i < 6) k.move();\n  }\n}`,
      },
    ],
  },

  12: {
    slug: "12-strings", title: "Strings",
    problems: [
      {
        key: "simple", label: "Simple", points: 5,
        world: `Dimension: (1, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Use a string's <code>.length</code>: for the word <code>"Karel"</code>, drop one beeper per letter (5 in total).`,
        starter: `function main(k) {\n  const word = "Karel";\n  \n}\n`,
        check: ["beepers"],
        solution: `function main(k) {\n  const word = "Karel";\n  for (let i = 0; i < word.length; i++) k.putBeeper();\n}`,
      },
      {
        key: "moderate", label: "Moderate", points: 10,
        world: `Dimension: (1, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Loop over the characters of <code>"beeper"</code> and count how many are the letter <code>"e"</code>. Drop that many beepers (there are 3).`,
        starter: `function main(k) {\n  const word = "beeper";\n  \n}\n`,
        check: ["beepers"],
        solution: `function main(k) {\n  const word = "beeper";\n  let count = 0;\n  for (const c of word) {\n    if (c === "e") count++;\n  }\n  for (let i = 0; i < count; i++) k.putBeeper();\n}`,
      },
      {
        key: "complex", label: "Complex", points: 15,
        world: `Dimension: (5, 5)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Treat the string <code>"MMLM"</code> as instructions: <code>"M"</code> means move, <code>"L"</code> means turn left. Run each character in order. Karel should finish at <code>(3, 2)</code> facing north.`,
        starter: `function main(k) {\n  const cmds = "MMLM";\n  \n}\n`,
        check: ["position", "direction"],
        solution: `function main(k) {\n  const cmds = "MMLM";\n  for (const c of cmds) {\n    if (c === "M") k.move();\n    else if (c === "L") k.turnLeft();\n  }\n}`,
      },
    ],
  },

  13: {
    slug: "13-arrays", title: "Arrays",
    problems: [
      {
        key: "simple", label: "Simple", points: 5,
        world: `Dimension: (1, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Sum the array <code>[1, 2, 3]</code> and drop that many beepers (6 total).`,
        starter: `function main(k) {\n  const nums = [1, 2, 3];\n  \n}\n`,
        check: ["beepers"],
        solution: `function main(k) {\n  const nums = [1, 2, 3];\n  let sum = 0;\n  for (const n of nums) sum += n;\n  for (let i = 0; i < sum; i++) k.putBeeper();\n}`,
      },
      {
        key: "moderate", label: "Moderate", points: 10,
        world: `Dimension: (4, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `The array <code>[1, 3, 2, 4]</code> says how many beepers each corner needs. Walk east and drop <code>counts[i]</code> beepers on corner <code>i</code>.`,
        starter: `function main(k) {\n  const counts = [1, 3, 2, 4];\n  \n}\n`,
        check: ["beepers", "position"],
        solution: `function main(k) {\n  const counts = [1, 3, 2, 4];\n  for (let i = 0; i < counts.length; i++) {\n    for (let j = 0; j < counts[i]; j++) k.putBeeper();\n    if (i < counts.length - 1) k.move();\n  }\n}`,
      },
      {
        key: "complex", label: "Complex", points: 15,
        world: `Dimension: (4, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `The array <code>["Red", "Blue", "Red", "Green"]</code> gives a colour per corner. Walk east and paint corner <code>i</code> with <code>colors[i]</code>.`,
        starter: `function main(k) {\n  const colors = ["Red", "Blue", "Red", "Green"];\n  \n}\n`,
        check: ["colors", "position"],
        solution: `function main(k) {\n  const colors = ["Red", "Blue", "Red", "Green"];\n  for (let i = 0; i < colors.length; i++) {\n    k.paintCorner(colors[i]);\n    if (i < colors.length - 1) k.move();\n  }\n}`,
      },
    ],
  },

  14: {
    slug: "14-objects", title: "Objects",
    problems: [
      {
        key: "simple", label: "Simple", points: 5,
        world: `Dimension: (1, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `The object <code>{ beepers: 4 }</code> describes a corner. Read its <code>beepers</code> property and drop that many beepers.`,
        starter: `function main(k) {\n  const corner = { beepers: 4 };\n  \n}\n`,
        check: ["beepers"],
        solution: `function main(k) {\n  const corner = { beepers: 4 };\n  for (let i = 0; i < corner.beepers; i++) k.putBeeper();\n}`,
      },
      {
        key: "moderate", label: "Moderate", points: 10,
        world: `Dimension: (4, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `The object <code>{ avenue: 4, street: 1 }</code> is Karel's target. Use its <code>avenue</code> property to move there, ending on <code>(4, 1)</code>.`,
        starter: `function main(k) {\n  const target = { avenue: 4, street: 1 };\n  \n}\n`,
        check: ["position"],
        solution: `function main(k) {\n  const target = { avenue: 4, street: 1 };\n  for (let i = 1; i < target.avenue; i++) k.move();\n}`,
      },
      {
        key: "complex", label: "Complex", points: 15,
        world: `Dimension: (3, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `An array of objects describes each corner: <code>[{color:"Red",beepers:1}, {color:"Blue",beepers:2}, {color:"Green",beepers:0}]</code>. Walk east; at each corner paint <code>plan[i].color</code> and drop <code>plan[i].beepers</code> beepers.`,
        starter: `function main(k) {\n  const plan = [\n    { color: "Red", beepers: 1 },\n    { color: "Blue", beepers: 2 },\n    { color: "Green", beepers: 0 },\n  ];\n  \n}\n`,
        check: ["beepers", "colors", "position"],
        solution: `function main(k) {\n  const plan = [\n    { color: "Red", beepers: 1 },\n    { color: "Blue", beepers: 2 },\n    { color: "Green", beepers: 0 },\n  ];\n  for (let i = 0; i < plan.length; i++) {\n    k.paintCorner(plan[i].color);\n    for (let j = 0; j < plan[i].beepers; j++) k.putBeeper();\n    if (i < plan.length - 1) k.move();\n  }\n}`,
      },
    ],
  },

  15: {
    slug: "15-maps", title: "Maps",
    problems: [
      {
        key: "simple", label: "Simple", points: 5,
        world: `Dimension: (1, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Build a <code>Map</code> from letter to a count — <code>new Map([["a", 3]])</code> — and drop <code>map.get("a")</code> beepers.`,
        starter: `function main(k) {\n  const map = new Map([["a", 3]]);\n  \n}\n`,
        check: ["beepers"],
        solution: `function main(k) {\n  const map = new Map([["a", 3]]);\n  const n = map.get("a");\n  for (let i = 0; i < n; i++) k.putBeeper();\n}`,
      },
      {
        key: "moderate", label: "Moderate", points: 10,
        world: `Dimension: (3, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `The map <code>new Map([[1, 2], [2, 0], [3, 3]])</code> gives a beeper count per corner number. Walk east and drop <code>counts.get(i)</code> beepers on corner <code>i</code> (1-based).`,
        starter: `function main(k) {\n  const counts = new Map([[1, 2], [2, 0], [3, 3]]);\n  \n}\n`,
        check: ["beepers", "position"],
        solution: `function main(k) {\n  const counts = new Map([[1, 2], [2, 0], [3, 3]]);\n  for (let i = 1; i <= 3; i++) {\n    for (let j = 0; j < counts.get(i); j++) k.putBeeper();\n    if (i < 3) k.move();\n  }\n}`,
      },
      {
        key: "complex", label: "Complex", points: 15,
        world: `Dimension: (3, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Use a <code>Map</code> as a palette lookup: <code>new Map([[1,"Red"],[2,"Green"],[3,"Blue"]])</code>. The array <code>[2, 3, 1]</code> gives a palette key per corner. Walk east and paint corner <code>i</code> with <code>palette.get(keys[i])</code>.`,
        starter: `function main(k) {\n  const palette = new Map([[1, "Red"], [2, "Green"], [3, "Blue"]]);\n  const keys = [2, 3, 1];\n  \n}\n`,
        check: ["colors", "position"],
        solution: `function main(k) {\n  const palette = new Map([[1, "Red"], [2, "Green"], [3, "Blue"]]);\n  const keys = [2, 3, 1];\n  for (let i = 0; i < keys.length; i++) {\n    k.paintCorner(palette.get(keys[i]));\n    if (i < keys.length - 1) k.move();\n  }\n}`,
      },
    ],
  },

  16: {
    slug: "16-scope", title: "Scope & Lifetime",
    problems: [
      {
        key: "simple", label: "Simple", points: 5,
        world: `Dimension: (1, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Write a helper <code>compute()</code> that uses a <strong>local</strong> variable <code>x = 2</code> and returns <code>x + 2</code>. That local is invisible outside the function. Drop <code>compute()</code> beepers (4).`,
        starter: `function compute() {\n  \n}\n\nfunction main(k) {\n  \n}\n`,
        check: ["beepers"],
        solution: `function compute() {\n  let x = 2;\n  return x + 2;\n}\n\nfunction main(k) {\n  const n = compute();\n  for (let i = 0; i < n; i++) k.putBeeper();\n}`,
      },
      {
        key: "moderate", label: "Moderate", points: 10,
        world: `Dimension: (5, 1)\nKarel: (1, 1); east\nBeeperBag: 0\nBeeper: (2, 1); 1\nBeeper: (4, 1); 1`,
        prompt: `A <code>total</code> variable declared <strong>outside</strong> the loop lives for the whole walk, while the loop's <code>i</code> lives only inside it. Walk all five corners counting the beepers you pick up, then drop <code>total</code> beepers on the last corner.`,
        starter: `function main(k) {\n  let total = 0;\n  \n}\n`,
        check: ["beepers", "position"],
        solution: `function main(k) {\n  let total = 0;\n  for (let i = 0; i < 5; i++) {\n    if (k.beepersPresent()) { k.pickBeeper(); total++; }\n    if (i < 4) k.move();\n  }\n  for (let i = 0; i < total; i++) k.putBeeper();\n}`,
      },
      {
        key: "complex", label: "Complex", points: 15,
        world: `Dimension: (3, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Write <code>fill(k, n)</code> whose loop counter <code>i</code> is local to it. Drive it from <code>main</code> with counts <code>[2, 1, 3]</code> — the two <code>i</code> variables never collide. Drop <code>counts[c]</code> beepers on each corner.`,
        starter: `function fill(k, n) {\n  \n}\n\nfunction main(k) {\n  const counts = [2, 1, 3];\n  \n}\n`,
        check: ["beepers", "position"],
        solution: `function fill(k, n) {\n  for (let i = 0; i < n; i++) k.putBeeper();\n}\n\nfunction main(k) {\n  const counts = [2, 1, 3];\n  for (let i = 0; i < counts.length; i++) {\n    fill(k, counts[i]);\n    if (i < counts.length - 1) k.move();\n  }\n}`,
      },
    ],
  },

  17: {
    slug: "17-recursion", title: "Recursion",
    problems: [
      {
        key: "simple", label: "Simple", points: 5,
        world: `Dimension: (6, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Write a <strong>recursive</strong> <code>walk(k)</code>: if the front is clear, move once and call <code>walk(k)</code> again. This carries Karel to the wall at <code>(6, 1)</code>.`,
        starter: `function walk(k) {\n  \n}\n\nfunction main(k) {\n  \n}\n`,
        check: ["position"],
        solution: `function walk(k) {\n  if (k.frontIsClear()) {\n    k.move();\n    walk(k);\n  }\n}\n\nfunction main(k) {\n  walk(k);\n}`,
      },
      {
        key: "moderate", label: "Moderate", points: 10,
        world: `Dimension: (1, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Write a recursive <code>putN(k, n)</code>: if <code>n</code> is 0 stop; otherwise drop one beeper and recurse with <code>n - 1</code>. Call <code>putN(k, 5)</code>.`,
        starter: `function putN(k, n) {\n  \n}\n\nfunction main(k) {\n  \n}\n`,
        check: ["beepers"],
        solution: `function putN(k, n) {\n  if (n <= 0) return;\n  k.putBeeper();\n  putN(k, n - 1);\n}\n\nfunction main(k) {\n  putN(k, 5);\n}`,
      },
      {
        key: "complex", label: "Complex", points: 15,
        world: `Dimension: (5, 1)\nKarel: (1, 1); east\nBeeperBag: 0\nBeeper: (1, 1); 1\nBeeper: (2, 1); 1\nBeeper: (3, 1); 1\nBeeper: (4, 1); 1\nBeeper: (5, 1); 1`,
        prompt: `Write a recursive <code>collect(k)</code>: pick up any beeper on the current corner, then — if the front is clear — move and recurse. It clears the whole corridor and stops at the wall.`,
        starter: `function collect(k) {\n  \n}\n\nfunction main(k) {\n  \n}\n`,
        check: ["beepers", "position"],
        solution: `function collect(k) {\n  if (k.beepersPresent()) k.pickBeeper();\n  if (k.frontIsClear()) {\n    k.move();\n    collect(k);\n  }\n}\n\nfunction main(k) {\n  collect(k);\n}`,
      },
    ],
  },

  18: {
    slug: "18-error-handling", title: "Error Handling",
    problems: [
      {
        key: "simple", label: "Simple", points: 5,
        world: `Dimension: (2, 1)\nKarel: (2, 1); east\nBeeperBag: INFINITY`,
        prompt: `Karel faces a wall, so <code>move()</code> will throw. Wrap it in <code>try</code> / <code>catch</code>: try to move, and if it fails, turn left instead. Karel should end at <code>(2, 1)</code> facing north.`,
        starter: STUB, check: ["position", "direction"],
        solution: `function main(k) {\n  try {\n    k.move();\n  } catch (e) {\n    k.turnLeft();\n  }\n}`,
      },
      {
        key: "moderate", label: "Moderate", points: 10,
        world: `Dimension: (6, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Instead of checking <code>frontIsClear()</code>, keep moving forever inside a <code>try</code> and let the wall collision's error stop you. Catch it so the program ends cleanly on <code>(6, 1)</code>.`,
        starter: STUB, check: ["position"],
        solution: `function main(k) {\n  try {\n    while (true) k.move();\n  } catch (e) {\n    // reached the wall\n  }\n}`,
      },
      {
        key: "complex", label: "Complex", points: 15,
        world: `Dimension: (5, 1)\nKarel: (1, 1); east\nBeeperBag: 0\nBeeper: (1, 1); 1\nBeeper: (3, 1); 1\nBeeper: (5, 1); 1`,
        prompt: `Some corners are empty, so <code>pickBeeper()</code> sometimes throws. Walk all five corners and, at each, <code>try</code> to pick a beeper and <code>catch</code> the failure when there isn't one. End on <code>(5, 1)</code> with every beeper collected.`,
        starter: STUB, check: ["beepers", "position"],
        solution: `function main(k) {\n  for (let i = 0; i < 5; i++) {\n    try {\n      k.pickBeeper();\n    } catch (e) {\n      // no beeper here\n    }\n    if (i < 4) k.move();\n  }\n}`,
      },
    ],
  },
};

// ─────────────────────────── VERIFY + EMIT ──────────────────────────────────

const checkOnly = process.argv.includes("--check");

function pad(n) { return String(n).padStart(2, "0"); }

async function verifyProblem(lessonNum, prob) {
  const { world, solution, check, end } = prob;
  // 1) The reference solution must run cleanly and match itself.
  const self = await gradeKarel(world, solution, { solution, check, end });
  if (self.error) throw new Error(`solution threw: ${self.error}`);
  if (!self.solved) throw new Error(`solution does not match itself (check=${check.join(",")})`);
  // 2) The starter must NOT already solve (otherwise the problem is trivial).
  //    A starter that fails to compile or throws is fine — that's "not solved".
  let starterSolved = false;
  try {
    const s = await gradeKarel(world, prob.starter, { solution, check, end });
    starterSolved = s.solved && !s.error;
  } catch { /* compile/parse failure counts as not-solved */ }
  if (starterSolved) throw new Error(`starter already solves the problem`);
  // 3) The starter must at least compile (so students open to valid code).
  try { compileProgram(prob.starter); }
  catch (e) { throw new Error(`starter does not compile: ${e.message}`); }
}

function emitManifest(lessonNum, lesson) {
  const id = `lesson-${pad(lessonNum)}`;
  const probLines = lesson.problems.map(p => {
    const endLine = p.end ? `\n      end: ${JSON.stringify(p.end)},` : "";
    return (
      `    {\n` +
      `      key: ${JSON.stringify(p.key)},\n` +
      `      label: ${JSON.stringify(p.label)},\n` +
      `      points: ${p.points},\n` +
      `      world: ${JSON.stringify(p.world)},\n` +
      `      prompt: ${JSON.stringify(p.prompt)},\n` +
      `      starter: ${JSON.stringify(p.starter)},\n` +
      `      check: ${JSON.stringify(p.check)},` + endLine + `\n` +
      `      solution: ${JSON.stringify(sealSolution(p.solution))},\n` +
      `    }`
    );
  }).join(",\n");
  const total = lesson.problems.reduce((s, p) => s + p.points, 0);
  const camel = "lesson" + pad(lessonNum);
  return (
`/**
 * Assignment "${id}" — companion to lessons/${lesson.slug}.html (${lesson.title}).
 *
 * GENERATED by tools/gen-lesson-assignments.js — edit the problem there and
 * regenerate; do not hand-edit the sealed solutions below. Each of the three
 * problems (simple / moderate / complex) stores its reference solution SEALED
 * (see tools/seal.js). The plaintext solutions live in the generator.
 */
export const ${camel} = {
  id: ${JSON.stringify(id)},
  lessonNum: ${lessonNum},
  lessonSlug: ${JSON.stringify(lesson.slug)},
  lessonTitle: ${JSON.stringify(lesson.title)},
  title: ${JSON.stringify(`Assignment ${lessonNum} · ${lesson.title}`)},
  points: ${total},
  problems: [
${probLines},
  ],
};

export default ${camel};
`
  );
}

async function main() {
  const nums = Object.keys(LESSONS).map(Number).sort((a, b) => a - b);
  let failures = 0;
  for (const n of nums) {
    const lesson = LESSONS[n];
    for (const prob of lesson.problems) {
      try {
        await verifyProblem(n, prob);
        console.log(`  ok   lesson-${pad(n)} ${prob.key}`);
      } catch (e) {
        failures++;
        console.error(`  FAIL lesson-${pad(n)} ${prob.key}: ${e.message}`);
      }
    }
  }
  if (failures) {
    console.error(`\n${failures} problem(s) failed verification — no files written.`);
    process.exit(1);
  }
  if (checkOnly) {
    console.log(`\nAll ${nums.length * 3} problems verified (--check: nothing written).`);
    return;
  }
  for (const n of nums) {
    const id = `lesson-${pad(n)}`;
    const path = join(ROOT, "assignments", `${id}.js`);
    writeFileSync(path, emitManifest(n, LESSONS[n]));
    console.log(`  wrote assignments/${id}.js`);
  }
  console.log(`\nGenerated ${nums.length} lesson manifests (${nums.length * 3} problems).`);
}

main();
