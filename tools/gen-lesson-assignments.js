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
        world: `Dimension: (2, 1)\nKarel: (1, 1); east\nBeeperBag: 0\nBeeper: (2, 1); 1`,
        prompt: `Step one corner east. There may or may not be a beeper there. Using a single <code>if</code>, pick the beeper up <strong>only if</strong> one is present.`,
        starter: STUB, check: ["beepers"],
        solution: `function main(k) {\n  k.move();\n  if (k.beepersPresent()) {\n    k.pickBeeper();\n  }\n}`,
      },
      {
        key: "moderate", label: "Moderate", points: 10,
        world: `Dimension: (4, 1)\nKarel: (1, 1); east\nBeeperBag: 0\nBeeper: (2, 1); 1\nBeeper: (4, 1); 1`,
        prompt: `Karel starts on an empty corner. Of the three corners east of it, some have a beeper and some don't. Visit all three (no loop yet — write it out). At each one, pick a beeper up only if one is present.`,
        starter: STUB, check: ["beepers", "position"],
        solution: `function main(k) {\n  k.move();\n  if (k.beepersPresent()) k.pickBeeper();\n  k.move();\n  if (k.beepersPresent()) k.pickBeeper();\n  k.move();\n  if (k.beepersPresent()) k.pickBeeper();\n}`,
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
        prompt: `An 8&times;8 grid is dusted with coloured corners &mdash; some <code>"Red"</code>, some <code>"Orange"</code>, some <code>"Blue"</code>, the rest bare. Karel must sweep the whole grid and leave beepers to match the colour it is standing on: <strong>1</strong> beeper on every red corner, <strong>2</strong> on every orange corner, <strong>3</strong> on every blue corner, and nothing on a bare corner.\n<p>You don't have loops yet, so this is a job for <strong>functions</strong> plus <code>if</code>. Write a helper that checks the current corner's colour with <code>cornerColorIs</code> and drops the right number of beepers, and another helper that walks one full row of eight corners applying it; then call them to cover the grid in a back-and-forth snake pattern &mdash; east along one street, up one, west along the next.</p>\n<p>Karel starts at <code>(1, 1)</code> facing east with an unlimited bag. Where Karel finishes doesn't matter &mdash; only the beepers are graded.</p>`,
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
        world: `Dimension: (6, 6)\nKarel: (1, 1); east\nBeeperBag: 0\nBeeper: (2, 2); 1\nBeeper: (3, 3); 1\nBeeper: (4, 4); 1\nBeeper: (5, 5); 1\nBeeper: (6, 6); 1`,
        prompt: `Karel starts on the empty corner <code>(1, 1)</code>. A beeper sits on every corner of the diagonal northeast of it, from <code>(2, 2)</code> up to <code>(6, 6)</code>. Use a <code>for</code> loop to walk the diagonal, picking up each beeper along the way, and finish on <code>(6, 6)</code>. Karel can only <code>turnLeft()</code>, so one step to the northeast means: move east, turn to face north, move north, then turn back to face east.`,
        starter: STUB, check: ["beepers", "position"],
        solution: `function main(k) {\n  for (let i = 0; i < 5; i++) {\n    k.move();\n    k.turnLeft();\n    k.move();\n    k.turnLeft();\n    k.turnLeft();\n    k.turnLeft();\n    k.pickBeeper();\n  }\n}`,
      },
      {
        key: "complex", label: "Complex", points: 15,
        world: `Dimension: (6, 6)\nKarel: (1, 1); east\nBeeperBag: 0\n` +
          // perimeter of the 5x5 square from (2, 2) to (6, 6): all 16 edge corners
          `Beeper: (2, 2); 1\nBeeper: (3, 2); 1\nBeeper: (4, 2); 1\nBeeper: (5, 2); 1\nBeeper: (6, 2); 1\n` +
          `Beeper: (6, 3); 1\nBeeper: (6, 4); 1\nBeeper: (6, 5); 1\nBeeper: (6, 6); 1\n` +
          `Beeper: (5, 6); 1\nBeeper: (4, 6); 1\nBeeper: (3, 6); 1\nBeeper: (2, 6); 1\n` +
          `Beeper: (2, 5); 1\nBeeper: (2, 4); 1\nBeeper: (2, 3); 1\n` +
          // interior diagonal
          `Beeper: (3, 3); 1\nBeeper: (4, 4); 1\nBeeper: (5, 5); 1`,
        prompt: `Karel starts on the empty corner <code>(1, 1)</code>, just south-west of a 5&times;5 square that runs from <code>(2, 2)</code> to <code>(6, 6)</code>. The square has a beeper on all 16 of its perimeter corners and one on each interior diagonal corner &mdash; <code>(3, 3)</code>, <code>(4, 4)</code>, <code>(5, 5)</code>. The starter already steps Karel north-east onto <code>(2, 2)</code>, facing east. From there, pick up every beeper with two loops, one after the other.\n<p><strong>1. A nested loop for the perimeter.</strong> The outer loop runs once per side (four sides). The inner loop walks that side &mdash; <code>pickBeeper()</code> then <code>move()</code>, four times. After the inner loop, <code>turnLeft()</code> to face the next side. Four sides later Karel is back on <code>(2, 2)</code>, facing east.</p>\n<p><strong>2. A simple loop for the diagonal.</strong> Three times: step one corner to the north-east (<code>move()</code>, <code>turnLeft()</code>, <code>move()</code>, <code>turnRight(k)</code>) and <code>pickBeeper()</code>.</p>\n<p>The <code>turnRight</code> helper is already written for you.</p>`,
        starter: `function turnRight(k) {\n  k.turnLeft();\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction main(k) {\n  // Step north-east onto (2, 2), facing east.\n  k.move();\n  k.turnLeft();\n  k.move();\n  turnRight(k);\n\n  // Loop 1: walk the perimeter (outer loop = 4 sides, inner loop = 4 steps)\n\n  // Loop 2: climb the diagonal, picking up (3,3), (4,4), (5,5)\n\n}\n`,
        check: ["beepers"],
        solution: `function turnRight(k) {\n  k.turnLeft();\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction main(k) {\n  k.move();\n  k.turnLeft();\n  k.move();\n  turnRight(k);\n  for (let side = 0; side < 4; side++) {\n    for (let step = 0; step < 4; step++) {\n      k.pickBeeper();\n      k.move();\n    }\n    k.turnLeft();\n  }\n  for (let i = 0; i < 3; i++) {\n    k.move();\n    k.turnLeft();\n    k.move();\n    turnRight(k);\n    k.pickBeeper();\n  }\n}`,
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
        world: `Dimension: (6, 1)\nKarel: (1, 1); east\nBeeperBag: 0\nBeeper: (2, 1); 1\nBeeper: (3, 1); 1\nBeeper: (4, 1); 1\nBeeper: (5, 1); 1\nBeeper: (6, 1); 1`,
        prompt: `Karel starts on an empty corner, and every corner east of it holds a beeper. Walk east to the wall, collecting <strong>every</strong> beeper along the way, and stop on the last corner.`,
        starter: STUB, check: ["beepers", "position"],
        solution: `function main(k) {\n  while (true) {\n    while (k.beepersPresent()) k.pickBeeper();\n    if (!k.frontIsClear()) break;\n    k.move();\n  }\n}`,
      },
      {
        key: "complex", label: "Complex", points: 15,
        world: `Dimension: (8, 8)\nKarel: (1, 1); east\nBeeperBag: 0\nBeeper: (2, 1); 1\nBeeper: (2, 2); 2\nBeeper: (2, 3); 3\nBeeper: (2, 4); 4\nBeeper: (2, 5); 5\nBeeper: (2, 6); 6\nBeeper: (2, 7); 7\nBeeper: (2, 8); 8`,
        prompt: `Eight piles of beepers sit along avenue 2 &mdash; one per street, and each pile is <strong>as many beepers as its street number</strong> (street 1 has 1 beeper, street 2 has 2, &hellip; street 8 has 8). Karel starts on the empty corner <code>(1, 1)</code>, just west of the first pile, facing east with an empty bag.\n<p>For every street, step onto that street's pile, carry the entire pile across to avenue 8 and drop it there, then move on to the next street.</p>\n<p>Use <code>while</code> loops to pick up and drop each pile &mdash; <code>beepersPresent()</code> and <code>beepersInBag()</code> tell Karel when a pile (or its own bag) is empty.</p>`,
        starter: STUB, check: ["beepers"],
        solution: `function main(k) {\n  while (true) {\n    k.move();\n    while (k.beepersPresent()) k.pickBeeper();\n    while (k.frontIsClear()) k.move();\n    while (k.beepersInBag()) k.putBeeper();\n    if (!k.leftIsClear()) break;\n    k.turnLeft();\n    k.move();\n    k.turnLeft();\n    while (k.frontIsClear()) k.move();\n    k.turnLeft();\n    k.turnLeft();\n  }\n}`,
      },
      {
        key: "complex2", label: "Complex II", points: 20,
        world: `Dimension: (16, 16)\nKarel: (1, 1); east\nBeeperBag: 0\nWall: (1, 3); north\nWall: (16, 5); north\nWall: (1, 7); north\nWall: (16, 9); north\nWall: (1, 11); north\nWall: (16, 13); north\nWall: (1, 15); north\nBeeper: (2, 3); 1\nBeeper: (3, 3); 1\nBeeper: (4, 3); 1\nBeeper: (5, 3); 1\nBeeper: (6, 3); 1\nBeeper: (7, 3); 1\nBeeper: (8, 3); 1\nBeeper: (9, 3); 1\nBeeper: (10, 3); 1\nBeeper: (11, 3); 1\nBeeper: (12, 3); 1\nBeeper: (13, 3); 1\nBeeper: (14, 3); 1\nBeeper: (15, 3); 1\nBeeper: (3, 5); 1\nBeeper: (4, 5); 1\nBeeper: (5, 5); 1\nBeeper: (6, 5); 1\nBeeper: (7, 5); 1\nBeeper: (8, 5); 1\nBeeper: (9, 5); 1\nBeeper: (10, 5); 1\nBeeper: (11, 5); 1\nBeeper: (12, 5); 1\nBeeper: (13, 5); 1\nBeeper: (14, 5); 1\nBeeper: (4, 7); 1\nBeeper: (5, 7); 1\nBeeper: (6, 7); 1\nBeeper: (7, 7); 1\nBeeper: (8, 7); 1\nBeeper: (9, 7); 1\nBeeper: (10, 7); 1\nBeeper: (11, 7); 1\nBeeper: (12, 7); 1\nBeeper: (13, 7); 1\nBeeper: (5, 9); 1\nBeeper: (6, 9); 1\nBeeper: (7, 9); 1\nBeeper: (8, 9); 1\nBeeper: (9, 9); 1\nBeeper: (10, 9); 1\nBeeper: (11, 9); 1\nBeeper: (12, 9); 1\nBeeper: (4, 11); 1\nBeeper: (5, 11); 1\nBeeper: (6, 11); 1\nBeeper: (7, 11); 1\nBeeper: (8, 11); 1\nBeeper: (9, 11); 1\nBeeper: (10, 11); 1\nBeeper: (11, 11); 1\nBeeper: (12, 11); 1\nBeeper: (13, 11); 1\nBeeper: (3, 13); 1\nBeeper: (4, 13); 1\nBeeper: (5, 13); 1\nBeeper: (6, 13); 1\nBeeper: (7, 13); 1\nBeeper: (8, 13); 1\nBeeper: (9, 13); 1\nBeeper: (10, 13); 1\nBeeper: (11, 13); 1\nBeeper: (12, 13); 1\nBeeper: (13, 13); 1\nBeeper: (14, 13); 1\nBeeper: (2, 15); 1\nBeeper: (3, 15); 1\nBeeper: (4, 15); 1\nBeeper: (5, 15); 1\nBeeper: (6, 15); 1\nBeeper: (7, 15); 1\nBeeper: (8, 15); 1\nBeeper: (9, 15); 1\nBeeper: (10, 15); 1\nBeeper: (11, 15); 1\nBeeper: (12, 15); 1\nBeeper: (13, 15); 1\nBeeper: (14, 15); 1\nBeeper: (15, 15); 1\nColor: (1, 16); Red`,
        prompt: `A 16&times;16 field is stacked with rows of beepers, one row every other street, forming a diamond that narrows and then widens again as it rises. Short walls pinch each row shut at one end or the other, so there is no way to skip a row &mdash; Karel has to sweep all the way across it before it can climb to the next one.\n<p>Karel starts at <code>(1, 1)</code> facing east with an empty bag and doesn't know how long any row is, how many rows there are, or which end of a row is open for climbing. Corner <code>(1, 16)</code> is painted <code>"Red"</code> &mdash; that's the finish line. Keep sweeping and climbing until Karel is standing on that red corner, picking up <strong>every</strong> beeper along the way.</p>\n<p><strong>Hints:</strong></p>\n<ul>\n<li>Nothing here is a fixed number &mdash; not the row length, not the row count, not which side has the opening. Every decision needs to come from a sensing command, not a hardcoded count.</li>\n<li>You've got <code>frontIsClear()</code>, <code>beepersPresent()</code>, and <code>cornerColorIs()</code> to work with. Think about what each one can tell Karel about its surroundings at any given moment, facing any given direction.</li>\n<li><code>cornerColorIs("Red")</code> is how Karel will recognize the finish &mdash; build your overall loop around watching for it rather than trying to count rows.</li>\n</ul>`,
        starter: STUB, check: ["beepers", "position"],
        solution: `function findRunRow(k) {\n  while (k.facingNorth() == false) {\n    k.turnLeft();\n  }\n  while (k.frontIsClear()) {\n    k.move();\n  }\n  k.turnLeft();\n  if (k.frontIsClear() == false) {\n    k.turnLeft();\n    k.turnLeft();\n  }\n  while (k.frontIsClear()) {\n    if (k.beepersPresent()) {\n      k.pickBeeper();\n    }\n    k.move();\n  }\n}\n\nfunction main(k) {\n  while (k.cornerColorIs("Red") == false) {\n    findRunRow(k);\n  }\n}`,
      },
    ],
  },

  6: {
    slug: "06-if-else", title: "if / else",
    problems: [
      {
        key: "simple", label: "Simple", points: 5,
        world: `Dimension: (3, 3)\nKarel: (1, 1); north\nBeeperBag: INFINITY\nBeeper: (1, 3); 1`,
        prompt: `Karel starts at <code>(1, 1)</code> facing north in a 3&times;3 room. Walk north to the wall, then turn right and walk east to the far wall. At <strong>each of the two corners where a wall stops you</strong> &mdash; <code>(1, 3)</code> and <code>(3, 3)</code> &mdash; make the same decision with one <code>if</code> / <code>else</code>: if a beeper is present, pick it up; otherwise, put one down. (One of those corners has a beeper and the other doesn't, so both branches get used.) Finish on <code>(3, 3)</code>.`,
        starter: STUB, check: ["beepers", "position"],
        solution: `function toggle(k) {\n  if (k.beepersPresent()) {\n    k.pickBeeper();\n  } else {\n    k.putBeeper();\n  }\n}\n\nfunction main(k) {\n  k.move();\n  k.move();\n  toggle(k);\n  k.turnLeft();\n  k.turnLeft();\n  k.turnLeft();\n  k.move();\n  k.move();\n  toggle(k);\n}`,
      },
      {
        key: "moderate", label: "Moderate", points: 10,
        world: `Dimension: (5, 4)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Karel starts at <code>(1, 1)</code> facing east in a 5&times;4 room. Walk along <strong>three</strong> walls &mdash; east along the south wall, north up the east wall, then west along the north wall &mdash; dropping a beeper on every corner Karel steps <em>onto</em> (the starting corner stays empty). Stop when Karel reaches <code>(1, 4)</code>.\n<p>Don't count the moves per side. Use one decision inside a loop, exactly as in the lesson: <code>if (k.frontIsClear())</code> move and put a beeper, <code>else</code> turn left &mdash; the walls tell Karel when to turn. The trip is 11 moves plus 2 turns, so the loop runs <strong>13</strong> times &mdash; that loop is already in the editor; fill in its body.</p>`,
        starter: `function main(k) {\n  for (let i = 0; i < 13; i++) {\n    \n  }\n}\n`,
        check: ["beepers", "position"],
        solution: `function main(k) {\n  for (let i = 0; i < 13; i++) {\n    if (k.frontIsClear()) {\n      k.move();\n      k.putBeeper();\n    } else {\n      k.turnLeft();\n    }\n  }\n}`,
      },
      {
        key: "complex", label: "Complex", points: 15,
        world: `Dimension: (5, 4)\nKarel: (1, 1); east\nBeeperBag: INFINITY\nBeeper: (2, 1); 1\nBeeper: (4, 1); 1\nBeeper: (5, 1); 1\nBeeper: (1, 2); 1\nBeeper: (3, 2); 1\nBeeper: (2, 3); 1\nBeeper: (5, 3); 1\nBeeper: (3, 4); 1\nBeeper: (4, 4); 1`,
        prompt: `Beepers are scattered across a 5&times;4 room. Visit <strong>every</strong> corner and paint each one <code>"Blue"</code> if it has a beeper and <code>"Red"</code> if it doesn't. Leave the beepers where they are.\n<p>Sweep the room like a lawnmower: east along the first street, up one, west along the next, up one, and so on &mdash; the snake from the lesson. That needs <em>two</em> <code>if</code> / <code>else</code> decisions: one at every corner (beeper or not?), and one at the end of each row, where which way Karel U-turns depends on <code>facingEast()</code>. Write them as helper functions, then let <code>main</code> alternate "sweep a row" and "climb to the next row" until all four rows are painted.</p>\n<p>Karel starts at <code>(1, 1)</code> facing east. Only the paint is graded &mdash; where Karel finishes doesn't matter.</p>`,
        starter: STUB, check: ["colors"],
        solution: `function turnRight(k) {\n  k.turnLeft();\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction paintCorner(k) {\n  if (k.beepersPresent()) {\n    k.paintCorner("Blue");\n  } else {\n    k.paintCorner("Red");\n  }\n}\n\nfunction paintRow(k) {\n  paintCorner(k);\n  while (k.frontIsClear()) {\n    k.move();\n    paintCorner(k);\n  }\n}\n\nfunction climbToNextRow(k) {\n  if (k.facingEast()) {\n    k.turnLeft();\n    k.move();\n    k.turnLeft();\n  } else {\n    turnRight(k);\n    k.move();\n    turnRight(k);\n  }\n}\n\nfunction main(k) {\n  for (let row = 0; row < 3; row++) {\n    paintRow(k);\n    climbToNextRow(k);\n  }\n  paintRow(k);\n}`,
      },
      {
        key: "advanced", label: "Advanced", points: 20,
        world: `Dimension: (6, 4)\nKarel: (1, 1); east\nBeeperBag: INFINITY\nColor: (2, 1); Red\nColor: (4, 1); Blue\nColor: (6, 1); Green\nColor: (1, 2); Green\nColor: (3, 2); Red\nColor: (5, 2); Blue\nColor: (2, 3); Blue\nColor: (4, 3); Green\nColor: (6, 3); Red\nColor: (1, 4); Red\nColor: (3, 4); Green\nColor: (5, 4); Blue\nBeeper: (6, 1); 1\nBeeper: (3, 2); 1\nBeeper: (4, 3); 1\nBeeper: (2, 4); 1`,
        prompt: `Karel manages a 6&times;4 stock room whose corners are painted <code>"Red"</code>, <code>"Green"</code> or <code>"Blue"</code> (the rest are bare). Sweep every corner and stock it by colour: <strong>4</strong> beepers on a red corner, <strong>2</strong> on a green one, <strong>1</strong> on a blue one, nothing on a bare corner.\n<p>There's one more rule, and it <em>overrides</em> the colours: <strong>a corner that already holds a beeper has been stocked &mdash; leave it exactly as it is, whatever its colour.</strong> Four corners start with a single beeper; when you're done each of them must still have exactly one.</p>\n<p>Write the decision as a single <code>if</code> / <code>else if</code> chain in a helper. Think about the <strong>order</strong> of the branches: a red corner that already has a beeper makes two of your conditions true at once, and the chain runs only the first one that matches &mdash; so the branch that must win has to come first. Reuse the lesson's snake to visit every corner (a row-sweeping helper plus a <code>facingEast()</code>-aware climb).</p>\n<p>Karel starts at <code>(1, 1)</code> facing east with an unlimited bag. Only the beepers are graded &mdash; where Karel finishes doesn't matter.</p>`,
        starter: STUB, check: ["beepers"],
        solution: `function turnRight(k) {\n  k.turnLeft();\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction stockCorner(k) {\n  if (k.beepersPresent()) {\n    // already stocked - leave it alone, whatever the colour\n  } else if (k.cornerColorIs("Red")) {\n    for (let i = 0; i < 4; i++) {\n      k.putBeeper();\n    }\n  } else if (k.cornerColorIs("Green")) {\n    for (let i = 0; i < 2; i++) {\n      k.putBeeper();\n    }\n  } else if (k.cornerColorIs("Blue")) {\n    k.putBeeper();\n  }\n}\n\nfunction stockRow(k) {\n  stockCorner(k);\n  while (k.frontIsClear()) {\n    k.move();\n    stockCorner(k);\n  }\n}\n\nfunction climbToNextRow(k) {\n  if (k.facingEast()) {\n    k.turnLeft();\n    k.move();\n    k.turnLeft();\n  } else {\n    turnRight(k);\n    k.move();\n    turnRight(k);\n  }\n}\n\nfunction main(k) {\n  for (let row = 0; row < 3; row++) {\n    stockRow(k);\n    climbToNextRow(k);\n  }\n  stockRow(k);\n}`,
      },
    ],
  },

  7: {
    slug: "07-parameters", title: "Parameters",
    problems: [
      {
        key: "simple", label: "Easy", points: 5,
        world: `Dimension: (5, 4)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Write <code>moveN(k, n)</code> that moves Karel <code>n</code> squares using a <code>for</code> loop. Then use it <strong>twice</strong> from <code>main</code>: walk 4 squares east, turn to face north, and walk 3 squares up to finish on <code>(5, 4)</code>. One function, two different arguments.`,
        starter: `function moveN(k, n) {\n  \n}\n\nfunction main(k) {\n  \n}\n`,
        check: ["position"],
        solution: `function moveN(k, n) {\n  for (let i = 0; i < n; i++) {\n    k.move();\n  }\n}\n\nfunction main(k) {\n  moveN(k, 4);\n  k.turnLeft();\n  moveN(k, 3);\n}`,
      },
      {
        key: "moderate", label: "Medium", points: 10,
        world: `Dimension: (6, 5)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Draw a bar chart. Write <code>drawBar(k, height)</code>: with Karel facing north at the bottom of a column, drop <strong>one beeper per corner</strong> going up until the bar is <code>height</code> tall, then walk back down to the bottom. Use it to draw bars of height <strong>2, 4, 3, 1, 5</strong> on avenues 1 through 5, stepping one avenue east between bars. Karel starts facing east, so turn north first.\n<p><code>turnRight</code> and <code>turnAround</code> are provided; write any other helpers you want (a <code>moveN</code> and a <code>nextColumn</code> make the job much easier). Only the beepers are graded &mdash; Karel may finish anywhere.</p>`,
        starter: `function turnRight(k) {\n  for (let i = 0; i < 3; i++) {\n    k.turnLeft();\n  }\n}\n\nfunction turnAround(k) {\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction drawBar(k, height) {\n  \n}\n\nfunction main(k) {\n  \n}\n`,
        check: ["beepers"],
        solution: `function turnRight(k) {\n  for (let i = 0; i < 3; i++) {\n    k.turnLeft();\n  }\n}\n\nfunction turnAround(k) {\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction moveN(k, n) {\n  for (let i = 0; i < n; i++) {\n    k.move();\n  }\n}\n\nfunction drawBar(k, height) {\n  for (let i = 0; i < height - 1; i++) {\n    k.putBeeper();\n    k.move();\n  }\n  k.putBeeper();\n  turnAround(k);\n  moveN(k, height - 1);\n  turnAround(k);\n}\n\nfunction nextColumn(k) {\n  turnRight(k);\n  k.move();\n  k.turnLeft();\n}\n\nfunction main(k) {\n  k.turnLeft();\n  drawBar(k, 2);\n  nextColumn(k);\n  drawBar(k, 4);\n  nextColumn(k);\n  drawBar(k, 3);\n  nextColumn(k);\n  drawBar(k, 1);\n  nextColumn(k);\n  drawBar(k, 5);\n}`,
      },
      {
        key: "complex", label: "Difficult", points: 15,
        world: `Dimension: (5, 4)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Paint a four-color frame around a 5&times;4 room using a function that takes a <strong>string</strong> and a <strong>number</strong>. Write <code>paintN(k, c, n)</code>: paint the current corner with the color <code>c</code>, step forward, and repeat <code>n</code> times &mdash; so <code>paintN(k, "Red", 4)</code> paints four corners red and leaves Karel on the corner after them. Inside the body pass <code>c</code> straight on to <code>paintCorner</code>; don't put quotes around it.\n<p>Then, from <code>main</code>, walk the border with a <code>turnLeft()</code> between legs: the south wall <strong>Red</strong>, the east wall <strong>Blue</strong>, the north wall <strong>Green</strong>, and the west wall <strong>Yellow</strong>. The room is wider than it is tall, so the legs are not all the same length &mdash; count how many corners each side needs so that every one of the 14 border corners is painted exactly once and the middle stays blank. Karel starts at <code>(1, 1)</code> facing east. Only the paint is graded.</p>`,
        starter: `function turnRight(k) {\n  for (let i = 0; i < 3; i++) {\n    k.turnLeft();\n  }\n}\n\nfunction turnAround(k) {\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction paintN(k, c, n) {\n  \n}\n\nfunction main(k) {\n  \n}\n`,
        check: ["colors"],
        solution: `function turnRight(k) {\n  for (let i = 0; i < 3; i++) {\n    k.turnLeft();\n  }\n}\n\nfunction turnAround(k) {\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction paintN(k, c, n) {\n  for (let i = 0; i < n; i++) {\n    k.paintCorner(c);\n    k.move();\n  }\n}\n\nfunction main(k) {\n  paintN(k, "Red", 4);\n  k.turnLeft();\n  paintN(k, "Blue", 3);\n  k.turnLeft();\n  paintN(k, "Green", 4);\n  k.turnLeft();\n  paintN(k, "Yellow", 3);\n}`,
      },
      {
        key: "hard", label: "Hard", points: 20,
        world: `Dimension: (8, 4)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Draw a pyramid and come home. Seven bars, one per avenue from 1 to 7, with heights <strong>1, 2, 3, 4, 3, 2, 1</strong> &mdash; one beeper per corner, stacked. Don't write seven calls by hand: use <code>for</code> loops and compute each bar's height from the loop counter (the lesson used <code>i + 1</code> to climb; think about what expression comes back down).\n<p>When the pyramid is finished, bring Karel back to <code>(1, 1)</code> facing <strong>east</strong>. A <code>moveN</code> with the right argument gets you most of the way there.</p>\n<p>Only <code>turnRight</code> and <code>turnAround</code> are provided &mdash; write <code>drawBar</code> and everything else yourself. Beepers, Karel's final position and facing are all graded.</p>`,
        starter: `function turnRight(k) {\n  for (let i = 0; i < 3; i++) {\n    k.turnLeft();\n  }\n}\n\nfunction turnAround(k) {\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction main(k) {\n  \n}\n`,
        check: ["beepers", "position", "direction"],
        solution: `function turnRight(k) {\n  for (let i = 0; i < 3; i++) {\n    k.turnLeft();\n  }\n}\n\nfunction turnAround(k) {\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction moveN(k, n) {\n  for (let i = 0; i < n; i++) {\n    k.move();\n  }\n}\n\nfunction drawBar(k, height) {\n  for (let i = 0; i < height - 1; i++) {\n    k.putBeeper();\n    k.move();\n  }\n  k.putBeeper();\n  turnAround(k);\n  moveN(k, height - 1);\n  turnAround(k);\n}\n\nfunction nextColumn(k) {\n  turnRight(k);\n  k.move();\n  k.turnLeft();\n}\n\nfunction main(k) {\n  k.turnLeft();\n  for (let i = 0; i < 4; i++) {\n    drawBar(k, i + 1);\n    nextColumn(k);\n  }\n  for (let i = 0; i < 3; i++) {\n    drawBar(k, 3 - i);\n    nextColumn(k);\n  }\n  k.turnLeft();\n  moveN(k, 7);\n  turnAround(k);\n}`,
      },
    ],
  },

  8: {
    slug: "08-variables", title: "Variables",
    problems: [
      {
        key: "simple", label: "Easy", points: 5,
        world: `Dimension: (5, 7)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Build an <strong>L with two equal arms</strong>. Karel starts at <code>(1, 1)</code> facing east and doesn't know how wide the room is. Put a beeper on every corner from the start to the east wall, then turn north and lay a second arm of beepers exactly as long as the first (the corner beeper is shared by both arms). The room is taller than it is wide, so the north wall won't tell Karel where to stop &mdash; a variable has to. Beepers and Karel's final position are graded.`,
        starter: STUB, check: ["beepers",  "position"],
        solution: `function main(k) {\n  let steps = 0;\n  k.putBeeper();\n  while (k.frontIsClear()) {\n    k.move();\n    k.putBeeper();\n    steps++;\n  }\n  k.turnLeft();\n  for (let i = 0; i < steps; i++) {\n    k.move();\n    k.putBeeper();\n  }\n}`,
      },
      {
        key: "moderate", label: "Medium", points: 10,
        world: `Dimension: (5, 4)\nKarel: (1, 1); east\nBeeperBag: INFINITY\nBeeper: (2, 1); 2\nBeeper: (4, 1); 1\nBeeper: (5, 1); 1\nBeeper: (1, 2); 1\nBeeper: (3, 2); 2\nBeeper: (2, 4); 1\nBeeper: (3, 4); 1\nBeeper: (4, 4); 1\nBeeper: (5, 4); 2`,
        prompt: `Every row of this room has beepers scattered along it, some in piles. For <strong>each row</strong>, gather all of that row's beepers into a single pile on the row's west-end corner (avenue 1). A row with no beepers stays empty. Karel's bag is unlimited, so it can't just empty the bag &mdash; it has to know how many it picked up. Use sensing, not fixed counts, to cross each row and to decide whether there's another row above. Only the beepers are graded.`,
        starter: STUB, check: ["beepers"],
        solution: `function turnRight(k) {\n  k.turnLeft();\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction turnAround(k) {\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction main(k) {\n  let checking = true;\n  while (checking) {\n    let count = 0;\n    while (k.beepersPresent()) {\n      k.pickBeeper();\n      count++;\n    }\n    while (k.frontIsClear()) {\n      k.move();\n      while (k.beepersPresent()) {\n        k.pickBeeper();\n        count++;\n      }\n    }\n    turnAround(k);\n    while (k.frontIsClear()) {\n      k.move();\n    }\n    for (let i = 0; i < count; i++) {\n      k.putBeeper();\n    }\n    turnRight(k);\n    if (k.frontIsClear()) {\n      k.move();\n      turnRight(k);\n    } else {\n      checking = false;\n    }\n  }\n}`,
      },
      {
        key: "complex", label: "Complex", points: 15,
        world: `Dimension: (5, 4)\nKarel: (1, 1); east\nBeeperBag: INFINITY\nColor: (2, 1); Red\nColor: (3, 1); Red\nColor: (5, 1); Green\nColor: (2, 2); Green\nColor: (4, 2); Green\nColor: (5, 2); Red\nColor: (2, 3); Red\nColor: (4, 3); Green\nColor: (1, 4); Red\nColor: (3, 4); Green\nColor: (5, 4); Green`,
        prompt: `Some corners in each row are painted <code>"Red"</code> or <code>"Green"</code>; the rest are blank. For <strong>each row</strong>, decide the row's majority color and paint every <em>blank</em> corner in that row with it &mdash; leave already-painted corners alone. If a row has the same number of red and green corners, fill its blanks with <code>"Yellow"</code> instead. Keep the chosen color in a <strong>string variable</strong> and pass it to a helper that does the painting. Only the paint is graded.`,
        starter: STUB, check: ["colors"],
        solution: `function turnRight(k) {\n  k.turnLeft();\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction turnAround(k) {\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction fillBlank(k, color) {\n  if (k.cornerColorIs("Red")) {\n    // already painted - leave it\n  } else if (k.cornerColorIs("Green")) {\n    // already painted - leave it\n  } else {\n    k.paintCorner(color);\n  }\n}\n\nfunction main(k) {\n  let checking = true;\n  while (checking) {\n    let redCount = 0;\n    let greenCount = 0;\n    if (k.cornerColorIs("Red")) redCount++;\n    if (k.cornerColorIs("Green")) greenCount++;\n    while (k.frontIsClear()) {\n      k.move();\n      if (k.cornerColorIs("Red")) redCount++;\n      if (k.cornerColorIs("Green")) greenCount++;\n    }\n    let winner = "Yellow";\n    if (redCount > greenCount) {\n      winner = "Red";\n    } else if (greenCount > redCount) {\n      winner = "Green";\n    }\n    turnAround(k);\n    fillBlank(k, winner);\n    while (k.frontIsClear()) {\n      k.move();\n      fillBlank(k, winner);\n    }\n    turnRight(k);\n    if (k.frontIsClear()) {\n      k.move();\n      turnRight(k);\n    } else {\n      checking = false;\n    }\n  }\n}`,
      },
      {
        key: "hard", label: "Hard", points: 20,
        world: `Dimension: (6, 5)\nKarel: (1, 1); east\nBeeperBag: INFINITY\nBeeper: (2, 1); 1\nBeeper: (5, 1); 1\nBeeper: (1, 2); 1\nBeeper: (3, 2); 1\nBeeper: (6, 2); 1\nBeeper: (2, 3); 1\nBeeper: (3, 3); 1\nBeeper: (4, 3); 1\nBeeper: (5, 3); 1\nBeeper: (6, 3); 1\nBeeper: (1, 4); 1\nBeeper: (2, 4); 1\nBeeper: (4, 4); 1\nBeeper: (6, 4); 1\nBeeper: (3, 5); 1`,
        prompt: `Single beepers are scattered across a 6&times;5 room. Find the row that holds the <strong>most</strong> beepers (there are no ties), then pick up every beeper in that row and put them all in one pile on the row's west-end corner. Every other row must be left untouched, and Karel must finish standing on the new pile. Karel doesn't know the size of the room or how many beepers any row holds in advance; it can't tell which row wins until it has looked at all of them. Beepers and Karel's final position are graded.`,
        starter: STUB, check: ["beepers",  "position"],
        solution: `function turnRight(k) {\n  k.turnLeft();\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction turnAround(k) {\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction main(k) {\n  let row = 1;\n  let bestRow = 1;\n  let bestCount = 0;\n  let checking = true;\n  while (checking) {\n    let count = 0;\n    if (k.beepersPresent()) count++;\n    while (k.frontIsClear()) {\n      k.move();\n      if (k.beepersPresent()) count++;\n    }\n    if (count > bestCount) {\n      bestCount = count;\n      bestRow = row;\n    }\n    turnAround(k);\n    while (k.frontIsClear()) {\n      k.move();\n    }\n    turnRight(k);\n    if (k.frontIsClear()) {\n      k.move();\n      turnRight(k);\n      row++;\n    } else {\n      checking = false;\n    }\n  }\n  turnAround(k);\n  for (let i = 0; i < row - bestRow; i++) {\n    k.move();\n  }\n  k.turnLeft();\n  if (k.beepersPresent()) k.pickBeeper();\n  while (k.frontIsClear()) {\n    k.move();\n    if (k.beepersPresent()) k.pickBeeper();\n  }\n  turnAround(k);\n  while (k.frontIsClear()) {\n    k.move();\n  }\n  for (let i = 0; i < bestCount; i++) {\n    k.putBeeper();\n  }\n}`,
      },
    ],
  },

  9: {
    slug: "09-returns", title: "Return Values",
    problems: [
      {
        key: "simple", label: "Simple", points: 5,
        world: `Dimension: (8, 8)\nKarel: (1, 1); east\nBeeperBag: INFINITY\nBeeper: (2, 1); 1\nColor: (2, 1); Blue\nColor: (3, 1); Blue\nBeeper: (5, 1); 1\nColor: (5, 1); Blue\nBeeper: (8, 1); 1\nBeeper: (2, 2); 1\nBeeper: (6, 2); 1\nColor: (6, 2); Blue\nColor: (4, 3); Blue\nBeeper: (7, 3); 1\nColor: (7, 3); Blue\nBeeper: (1, 4); 1\nColor: (1, 4); Blue\nBeeper: (5, 4); 1\nBeeper: (3, 5); 1\nColor: (3, 5); Blue\nColor: (8, 5); Blue\nBeeper: (2, 6); 1\nColor: (2, 6); Blue\nBeeper: (6, 6); 1\nColor: (4, 7); Blue\nBeeper: (7, 7); 1\nColor: (7, 7); Blue\nBeeper: (1, 8); 1\nColor: (1, 8); Blue\nBeeper: (5, 8); 1\nBeeper: (8, 8); 1\nColor: (8, 8); Blue`,
        prompt: `Some corners in this 8&times;8 room hold a beeper, and some are painted <code>"Blue"</code> &mdash; but only a corner with <strong>both</strong> is real treasure. Write <code>isTreasure(k)</code>: <code>return</code> the combined expression <code>k.cornerColorIs("Blue") && k.beepersPresent()</code> directly, true only when both hold. Sweep the <strong>entire grid</strong> &mdash; eight rows, in a back-and-forth snake pattern (east, turn up, west, turn up, east) &mdash; and call <code>isTreasure(k)</code> directly inside an <code>if</code> to decide whether to pick up the beeper at each corner. Leave beepers on non-treasure corners alone.`,
        starter: `function isTreasure(k) {\n  \n}\n\nfunction main(k) {\n  \n}\n`,
        check: ["beepers"],
        end: { avenue: 1, street: 8, direction: "west" },
        solution: `function isTreasure(k) {\n  return k.cornerColorIs("Blue") && k.beepersPresent();\n}\n\nfunction turnRight(k) {\n  k.turnLeft();\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction main(k) {\n  for (let row = 0; row < 8; row++) {\n    if (isTreasure(k)) k.pickBeeper();\n    for (let col = 0; col < 7; col++) {\n      k.move();\n      if (isTreasure(k)) k.pickBeeper();\n    }\n    if (row < 7) {\n      if (k.facingEast()) {\n        k.turnLeft();\n        k.move();\n        k.turnLeft();\n      } else {\n        turnRight(k);\n        k.move();\n        turnRight(k);\n      }\n    }\n  }\n}`,
      },
      {
        key: "moderate", label: "Moderate", points: 10,
        world: `Dimension: (4, 3)\nKarel: (1, 1); east\nBeeperBag: INFINITY\nColor: (3, 1); Green\nColor: (1, 2); Green\nColor: (2, 2); Green\nColor: (4, 3); Green`,
        prompt: `A 4&times;3 room has a few corners painted <code>"Green"</code>, scattered with no pattern. Write <code>countGreen(k)</code> that sweeps the <strong>entire grid</strong> &mdash; all three rows, in a back-and-forth snake pattern (east, turn up, west, turn up, east) &mdash; and <code>return</code>s the total number of green corners. Capture that number in a variable, and once the sweep ends, drop that many beepers on the final corner.`,
        starter: `function countGreen(k) {\n  let count = 0;\n  \n  return count;\n}\n\nfunction main(k) {\n  \n}\n`,
        check: ["beepers", "position"],
        end: { avenue: 4, street: 3, direction: "east" },
        solution: `function turnRight(k) {\n  k.turnLeft();\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction countGreen(k) {\n  let count = 0;\n  for (let row = 0; row < 3; row++) {\n    if (k.cornerColorIs("Green")) count++;\n    for (let col = 0; col < 3; col++) {\n      k.move();\n      if (k.cornerColorIs("Green")) count++;\n    }\n    if (row < 2) {\n      if (k.facingEast()) {\n        k.turnLeft();\n        k.move();\n        k.turnLeft();\n      } else {\n        turnRight(k);\n        k.move();\n        turnRight(k);\n      }\n    }\n  }\n  return count;\n}\n\nfunction main(k) {\n  const total = countGreen(k);\n  for (let i = 0; i < total; i++) {\n    k.putBeeper();\n  }\n}`,
      },
      {
        key: "complex", label: "Complex", points: 15,
        world: `Dimension: (8, 8)\nKarel: (1, 1); east\nBeeperBag: 0\nBeeper: (2, 1); 3\nBeeper: (3, 1); 5\nBeeper: (5, 3); 6\nBeeper: (6, 3); 2\nBeeper: (1, 5); 2\nBeeper: (2, 5); 4\nBeeper: (6, 7); 5\nBeeper: (7, 7); 1`,
        prompt: `An 8&times;8 room hides four pairs of beeper piles, each pair sitting on two corners immediately next to each other along a row. Karel starts at <code>(1, 1)</code> facing east, and the travel between pairs is already wired up in <code>main</code> below &mdash; your job is the two functions it calls at each stop.\n<p>Write <code>beepersInLargerPile(k)</code>, called while Karel stands on a pair's <strong>left-hand corner, facing east</strong> toward its right-hand partner: pick up and count the pile under Karel, move forward and do the same to the neighboring pile, then <code>return</code> the string <code>"right"</code> or <code>"left"</code> naming whichever pile was bigger. Leave Karel back where it started, facing the same way.</p>\n<p>Then write <code>markWinner(k, winner)</code>, which takes that return value and paints <code>"Red"</code> onto whichever corner of the pair actually held more beepers &mdash; again leaving Karel back on the pair's left-hand corner, facing east, so the next pair can be found the same way.</p>`,
        starter: `function beepersInLargerPile(k) {\n  let leftCount = 0;\n  let rightCount = 0;\n  \n}\n\nfunction markWinner(k, winner) {\n  \n}\n\nfunction turnRight(k) {\n  k.turnLeft();\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction turnAround(k) {\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction main(k) {\n  k.move();\n  markWinner(k, beepersInLargerPile(k));\n\n  for (let i = 0; i < 3; i++) k.move();\n  k.turnLeft();\n  k.move();\n  k.move();\n  turnRight(k);\n  markWinner(k, beepersInLargerPile(k));\n\n  k.turnLeft();\n  k.move();\n  k.move();\n  k.turnLeft();\n  for (let i = 0; i < 4; i++) k.move();\n  turnRight(k);\n  turnRight(k);\n  markWinner(k, beepersInLargerPile(k));\n\n  k.turnLeft();\n  k.move();\n  k.move();\n  turnRight(k);\n  for (let i = 0; i < 5; i++) k.move();\n  markWinner(k, beepersInLargerPile(k));\n}\n`,
        check: ["colors"],
        solution: `function turnRight(k) {\n  k.turnLeft();\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction turnAround(k) {\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction beepersInLargerPile(k) {\n  let leftCount = 0;\n  let rightCount = 0;\n\n  while (k.beepersPresent()) {\n    k.pickBeeper();\n    leftCount++;\n  }\n  k.move();\n  while (k.beepersPresent()) {\n    k.pickBeeper();\n    rightCount++;\n  }\n  turnAround(k);\n  k.move();\n  turnAround(k);\n\n  if (rightCount > leftCount) return "right";\n  return "left";\n}\n\nfunction markWinner(k, winner) {\n  if (winner === "right") {\n    k.move();\n    k.paintCorner("Red");\n    turnAround(k);\n    k.move();\n    turnAround(k);\n  } else {\n    k.paintCorner("Red");\n  }\n}\n\nfunction main(k) {\n  k.move();\n  markWinner(k, beepersInLargerPile(k));\n\n  for (let i = 0; i < 3; i++) k.move();\n  k.turnLeft();\n  k.move();\n  k.move();\n  turnRight(k);\n  markWinner(k, beepersInLargerPile(k));\n\n  k.turnLeft();\n  k.move();\n  k.move();\n  k.turnLeft();\n  for (let i = 0; i < 4; i++) k.move();\n  turnRight(k);\n  turnRight(k);\n  markWinner(k, beepersInLargerPile(k));\n\n  k.turnLeft();\n  k.move();\n  k.move();\n  turnRight(k);\n  for (let i = 0; i < 5; i++) k.move();\n  markWinner(k, beepersInLargerPile(k));\n}`,
      },
      {
        key: "complex2", label: "Complex II", points: 20,
        world: `Dimension: (8, 8)\nKarel: (1, 1); east\nBeeperBag: INFINITY\nBeeper: (2, 1); 1\nColor: (2, 1); Orange\nColor: (3, 1); Orange\nBeeper: (5, 1); 1\nBeeper: (8, 1); 1\nColor: (8, 1); Orange\nBeeper: (2, 2); 1\nColor: (2, 2); Orange\nBeeper: (6, 2); 1\nBeeper: (4, 4); 1\nColor: (4, 4); Orange\nColor: (7, 4); Orange\nBeeper: (1, 5); 1\nColor: (1, 5); Orange\nBeeper: (5, 5); 1\nColor: (5, 5); Orange\nBeeper: (3, 6); 1\nColor: (6, 6); Orange\nBeeper: (2, 7); 1\nColor: (2, 7); Orange\nBeeper: (8, 7); 1\nColor: (8, 7); Orange\nBeeper: (5, 8); 1\nColor: (5, 8); Orange`,
        prompt: `An 8&times;8 room mixes beepers and <code>"Orange"</code> paint &mdash; some corners have one, some the other, some both, most neither. Only a corner with <strong>both</strong> counts as marked. Write <code>isMarked(k)</code>: <code>return k.beepersPresent() && k.cornerColorIs("Orange")</code> directly, then a helper <code>collectMarked(k)</code> that sweeps <strong>one row</strong>: it picks up the beeper at every marked corner it passes and <code>return</code>s how many it collected. Call <code>collectMarked(k)</code> once per row &mdash; eight rows, in a back-and-forth snake pattern &mdash; adding each row's return value into a running total. When the sweep is done, drop that many beepers on the final corner.`,
        starter: `function isMarked(k) {\n  \n}\n\nfunction collectMarked(k) {\n  let count = 0;\n  \n  return count;\n}\n\nfunction main(k) {\n  let total = 0;\n  \n}\n`,
        check: ["beepers", "position"],
        end: { avenue: 1, street: 8, direction: "west" },
        solution: `function isMarked(k) {\n  return k.beepersPresent() && k.cornerColorIs("Orange");\n}\n\nfunction collectMarked(k) {\n  let count = 0;\n  if (isMarked(k)) {\n    k.pickBeeper();\n    count++;\n  }\n  for (let i = 0; i < 7; i++) {\n    k.move();\n    if (isMarked(k)) {\n      k.pickBeeper();\n      count++;\n    }\n  }\n  return count;\n}\n\nfunction turnRight(k) {\n  k.turnLeft();\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction main(k) {\n  let total = 0;\n  for (let row = 0; row < 8; row++) {\n    total = total + collectMarked(k);\n    if (row < 7) {\n      if (k.facingEast()) {\n        k.turnLeft();\n        k.move();\n        k.turnLeft();\n      } else {\n        turnRight(k);\n        k.move();\n        turnRight(k);\n      }\n    }\n  }\n  for (let i = 0; i < total; i++) {\n    k.putBeeper();\n  }\n}`,
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
        prompt: `Fill the entire 3×3 grid with beepers, one on every corner. Sweep the rows in a back-and-forth snake pattern so you never waste moves.`,
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
        world: `Dimension: (20, 20)\nKarel: (1, 3); east\nBeeperBag: INFINITY\nBeeper: (2, 3); 1\nBeeper: (3, 3); 1\nBeeper: (5, 3); 1\nBeeper: (6, 3); 1\nBeeper: (7, 3); 1\nBeeper: (1, 4); 1\nBeeper: (2, 4); 1\nBeeper: (3, 4); 1\nBeeper: (5, 4); 1\nBeeper: (1, 5); 1\nBeeper: (5, 5); 1\nBeeper: (6, 5); 1\nBeeper: (1, 6); 1\nBeeper: (2, 6); 1\nBeeper: (5, 6); 1\nBeeper: (6, 6); 1`,
        prompt: `Karel stands at the start of street 3, facing east. Four streets (3&ndash;6) each hold two groups of beepers: a <strong>left group</strong> in avenues 1&ndash;3 and a <strong>right group</strong> in avenues 5&ndash;7, each with 1, 2 or 3 beepers on that street. Process <em>each street individually</em>: count the beepers in its left group and in its right group, store the two counts in variables, then use a <code>for</code> loop over their <em>sum</em> to lay out that many beepers in a row on the same street, starting at avenue 9 (to the right of both groups). Leave the original beepers where they are.`,
        starter: `function main(k) {\n  \n}\n`,
        check: ["beepers"],
        solution: `function main(k) {\n  for (let row = 0; row < 4; row++) {\n    let left = 0;\n    let right = 0;\n    for (let avenue = 1; avenue <= 7; avenue++) {\n      if (k.beepersPresent()) {\n        if (avenue <= 3) left = left + 1;\n        else right = right + 1;\n      }\n      if (avenue < 7) k.move();\n    }\n    k.move();\n    k.move();\n    const total = left + right;\n    for (let i = 0; i < total; i++) {\n      k.putBeeper();\n      k.move();\n    }\n    k.turnLeft();\n    k.turnLeft();\n    for (let i = 0; i < 8 + total; i++) k.move();\n    if (row < 3) {\n      for (let i = 0; i < 3; i++) k.turnLeft();\n      k.move();\n      for (let i = 0; i < 3; i++) k.turnLeft();\n    }\n  }\n}`,
      },
      {
        key: "moderate", label: "Moderate", points: 10,
        world: `Dimension: (6, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Karel has <strong>17</strong> beepers to pack into boxes that each hold <strong>5</strong>. Starting on avenue 1 and facing east, put one full box (5 beepers) on each corner for as many <em>whole</em> boxes as fit, then put the <em>leftover</em> beepers on the next corner. That is 5, 5, 5 on avenues 1&ndash;3 and 2 on avenue 4. Store <code>17</code> and <code>5</code> in variables and <em>compute</em> the number of full boxes with <code>Math.floor(17 / 5)</code> and the leftover with <code>17 % 5</code>&mdash;don't type <code>3</code> or <code>2</code> yourself. Where Karel ends up is up to you.`,
        starter: STUB, check: ["beepers"],
        solution: `function main(k) {\n  const total = 17;\n  const size = 5;\n  const boxes = Math.floor(total / size);\n  const leftover = total % size;\n  for (let b = 0; b < boxes; b++) {\n    for (let i = 0; i < size; i++) k.putBeeper();\n    k.move();\n  }\n  for (let i = 0; i < leftover; i++) k.putBeeper();\n}`,
      },
      {
        key: "complex", label: "Complex", points: 15,
        world: `Dimension: (7, 6)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `A multiplication table, wrapped around. On every corner of the 7&times;6 world, put down <code>(avenue * street) % 5</code> beepers: so <code>(3, 4)</code> gets <code>12 % 5 = 2</code> beepers, and <code>(5, 2)</code> gets none. Karel starts on <code>(1, 1)</code> facing east, and the world is empty to begin with. Keep track of the current avenue and street in variables, and let <code>%</code> decide how many beepers each corner gets. Where Karel ends up is up to you.`,
        starter: STUB, check: ["beepers"],
        solution: `function main(k) {\n  for (let street = 1; street <= 6; street++) {\n    for (let avenue = 1; avenue <= 7; avenue++) {\n      const count = (avenue * street) % 5;\n      for (let i = 0; i < count; i++) k.putBeeper();\n      if (avenue < 7) k.move();\n    }\n    k.turnLeft();\n    k.turnLeft();\n    for (let i = 0; i < 6; i++) k.move();\n    k.turnLeft();\n    k.turnLeft();\n    if (street < 6) {\n      k.turnLeft();\n      k.move();\n      k.turnLeft();\n      k.turnLeft();\n      k.turnLeft();\n    }\n  }\n}`,
      },
    ],
  },

  12: {
    slug: "12-strings", title: "Strings",
    problems: [
      {
        key: "simple", label: "Simple", points: 5,
        world: `Dimension: (3, 6)\nKarel: (2, 1); north\nBeeperBag: INFINITY`,
        prompt: `Join <code>first</code> and <code>second</code> into one word (with <code>+</code> or a template literal), then use the joined word's <code>.length</code> to climb the middle column, putting down one beeper per letter. <code>"Kar"</code> + <code>"el"</code> is 5 letters, so 5 beepers.`,
        starter: `function main(k) {\n  let first = "Kar";\n  let second = "el";\n  \n}\n`,
        check: ["beepers"],
        solution: `function main(k) {\n  let first = "Kar";\n  let second = "el";\n  let word = \`\${first}\${second}\`;\n  for (let i = 0; i < word.length; i++) {\n    k.putBeeper();\n    k.move();\n  }\n}`,
      },
      {
        key: "moderate", label: "Moderate", points: 10,
        world: `Dimension: (6, 2)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `For the word <code>"beeper"</code>: loop over its characters and count how many are <code>"e"</code>, and drop that many beepers on Karel's starting corner (there are 3). Then use <code>indexOf</code> to find the position of the first <code>"p"</code>, move east that many corners, and drop one more beeper there.`,
        starter: `function main(k) {\n  let word = "beeper";\n  \n}\n`,
        check: ["beepers"],
        solution: `function main(k) {\n  let word = "beeper";\n  let count = 0;\n  for (let i = 0; i < word.length; i++) {\n    if (word[i] === "e") count++;\n  }\n  for (let i = 0; i < count; i++) k.putBeeper();\n  let pos = word.indexOf("p");\n  for (let i = 0; i < pos; i++) k.move();\n  k.putBeeper();\n}`,
      },
      {
        key: "complex", label: "Complex", points: 15,
        world: `Dimension: (5, 4)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Run the counted tape <code>"m4l1M3L1m2"</code>. Characters come in pairs: a command (<code>M</code> = move, <code>L</code> = turn left, in <em>either</em> case) followed by a one-digit count. Convert the command's case and the count's type before using them. Karel should finish at <code>(3, 4)</code> facing west.`,
        starter: `function main(k) {\n  let cmds = "m4l1M3L1m2";\n  \n}\n`,
        check: ["position", "direction"],
        solution: `function main(k) {\n  let cmds = "m4l1M3L1m2";\n  for (let i = 0; i < cmds.length; i += 2) {\n    let c = cmds[i].toUpperCase();\n    let times = Number(cmds[i + 1]);\n    for (let j = 0; j < times; j++) {\n      if (c === "M") k.move();\n      if (c === "L") k.turnLeft();\n    }\n  }\n}`,
      },
      {
        key: "complex2", label: "Complex II", points: 20,
        world: `Dimension: (5, 3)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Remix the plan <code>"RGBYC"</code> (R = Red, G = Green, B = Blue, Y = Yellow, C = Cyan) into three rows, each painted west to east starting at column 1. <strong>Bottom row:</strong> the plan as-is. <strong>Middle row:</strong> the plan reversed, built one character at a time with a loop. <strong>Top row:</strong> the plan rotated by one — its first character moved to the end (use <code>slice</code>). Compute every row from <code>plan</code>; don't type the remixed strings by hand.`,
        starter: STUB, check: ["colors"],
        solution: `function paint(k, code) {\n  if (code === "R") k.paintCorner("Red");\n  if (code === "G") k.paintCorner("Green");\n  if (code === "B") k.paintCorner("Blue");\n  if (code === "Y") k.paintCorner("Yellow");\n  if (code === "C") k.paintCorner("Cyan");\n}\n\nfunction paintRow(k, row) {\n  for (let i = 0; i < row.length; i++) {\n    paint(k, row[i]);\n    if (k.frontIsClear()) k.move();\n  }\n}\n\nfunction nextRow(k) {\n  k.turnLeft();\n  k.turnLeft();\n  while (k.frontIsClear()) k.move();\n  k.turnLeft();\n  k.turnLeft();\n  k.turnLeft();\n  k.move();\n  k.turnLeft();\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction main(k) {\n  let plan = "RGBYC";\n  let reversed = "";\n  for (let i = 0; i < plan.length; i++) {\n    reversed = plan[i] + reversed;\n  }\n  let rotated = plan.slice(1) + plan[0];\n  paintRow(k, plan);\n  nextRow(k);\n  paintRow(k, reversed);\n  nextRow(k);\n  paintRow(k, rotated);\n}`,
      },
    ],
  },

  13: {
    slug: "13-arrays", title: "Arrays",
    problems: [
      {
        key: "simple", label: "Simple", points: 5,
        world: `Dimension: (5, 4)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Paint a bar chart. The starter holds two arrays of the same length: bar <code>i</code> stands on avenue <code>i + 1</code>, rises from street 1, is <code>heights[i]</code> corners tall, and is painted <code>colors[i]</code>. So the first bar is 2 Red corners on avenue 1, and the third is a single Yellow corner on avenue 3. Use a loop over the arrays and read every height and color from them; don't type the five bars out by hand.`,
        starter: "function main(k) {\n  let heights = [2, 4, 1, 3, 2];\n  let colors = [\"Red\", \"Orange\", \"Yellow\", \"Green\", \"Blue\"];\n  \n}\n",
        check: ["colors"],
        solution: `function turnAround(k) {\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction main(k) {\n  let heights = [2, 4, 1, 3, 2];\n  let colors = ["Red", "Orange", "Yellow", "Green", "Blue"];\n  for (let i = 0; i < heights.length; i++) {\n    // Climb avenue i + 1, painting heights[i] corners.\n    k.turnLeft();\n    for (let h = 0; h < heights[i]; h++) {\n      k.paintCorner(colors[i]);\n      if (h < heights[i] - 1) {\n        k.move();\n      }\n    }\n    // Back down to street 1, then on to the next avenue facing east.\n    turnAround(k);\n    while (k.frontIsClear()) {\n      k.move();\n    }\n    k.turnLeft();\n    if (k.frontIsClear()) {\n      k.move();\n    }\n  }\n}`,
      },
      {
        key: "moderate", label: "Moderate", points: 10,
        world: `Dimension: (5, 5)\nKarel: (1, 1); east\nBeeperBag: INFINITY\nBeeper: (1, 2); 2\nBeeper: (3, 2); 1\nBeeper: (2, 3); 1\nBeeper: (3, 3); 2\nBeeper: (5, 3); 1\nBeeper: (1, 4); 1\nBeeper: (4, 4); 3\nBeeper: (2, 5); 2\nBeeper: (3, 5); 1\nBeeper: (5, 5); 1`,
        prompt: `<strong>Gravity.</strong> Every beeper in this 5&times;5 world falls straight down to street 1, which starts out empty: when it's over, the bottom corner of each avenue holds <em>all</em> the beepers that were anywhere in that avenue, and every other corner is empty. Sweep the world <strong>street by street</strong> (west to east along each street, starting on street 1), picking up every pile, and keep a running total per avenue in a fixed-size array: <code>let totals = new Array(5).fill(0);</code>, with <code>totals[c]</code> for avenue <code>c + 1</code>. When the sweep is done, go back to street 1 and drop each avenue's total.`,
        starter: STUB, check: ["beepers"],
        solution: `// Pick up the whole pile on this corner and return its size.\nfunction takePile(k) {\n  let n = 0;\n  while (k.beepersPresent()) {\n    k.pickBeeper();\n    n++;\n  }\n  return n;\n}\n\nfunction turnAround(k) {\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction turnRight(k) {\n  k.turnLeft();\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction main(k) {\n  let totals = new Array(5).fill(0);  // totals[c]: beepers found on avenue c + 1\n\n  // Sweep street by street, adding every pile to its avenue's total.\n  for (let row = 0; row < 5; row++) {\n    for (let c = 0; c < 5; c++) {\n      totals[c] = totals[c] + takePile(k);\n      if (c < 4) {\n        k.move();\n      }\n    }\n    turnAround(k);\n    while (k.frontIsClear()) {\n      k.move();\n    }\n    turnRight(k);\n    if (k.frontIsClear()) {\n      k.move();\n    }\n    turnRight(k);\n  }\n\n  // Karel is at (1, 5) facing east: drop down to street 1.\n  turnRight(k);\n  while (k.frontIsClear()) {\n    k.move();\n  }\n  k.turnLeft();\n\n  // Let everything land.\n  for (let c = 0; c < 5; c++) {\n    for (let b = 0; b < totals[c]; b++) {\n      k.putBeeper();\n    }\n    if (c < 4) {\n      k.move();\n    }\n  }\n}`,
      },
      {
        key: "complex", label: "Complex", points: 15,
        world: `Dimension: (6, 8)\nKarel: (1, 1); east\nBeeperBag: INFINITY\nBeeper: (1, 2); 2\nBeeper: (2, 2); 1\nBeeper: (3, 2); 3\nBeeper: (1, 3); 1\nBeeper: (2, 3); 1\nBeeper: (3, 3); 1\nBeeper: (4, 3); 2\nBeeper: (5, 3); 1\nBeeper: (1, 5); 3\nBeeper: (2, 5); 2\nBeeper: (3, 5); 1\nBeeper: (4, 5); 1\nBeeper: (5, 5); 2\nBeeper: (6, 5); 1\nBeeper: (1, 6); 4\nBeeper: (1, 7); 1\nBeeper: (2, 7); 3\nBeeper: (1, 8); 2\nBeeper: (2, 8); 2\nBeeper: (3, 8); 1\nBeeper: (4, 8); 3`,
        prompt: `<strong>Right-justify the text.</strong> Each street holds one "word": a run of non-empty piles that starts on avenue 1 and ends at the first empty corner (or the east wall). A street may be blank: street 1, where Karel starts, is. Slide every word east so its <em>last</em> pile sits against the east wall, keeping the piles in the same order. Street 2's word <code>2 1 3</code> ends up on avenues 4, 5, 6. Don't hard-code the world's size or the words' lengths: <code>push</code> each pile as you pick up the word, walk to the east wall, then lay the word back down walking <em>west</em>. Which array method hands you the piles in the order you need?`,
        starter: STUB, check: ["beepers"],
        solution: `// Pick up the whole pile on this corner and return its size.\nfunction takePile(k) {\n  let n = 0;\n  while (k.beepersPresent()) {\n    k.pickBeeper();\n    n++;\n  }\n  return n;\n}\n\nfunction putMany(k, n) {\n  for (let i = 0; i < n; i++) {\n    k.putBeeper();\n  }\n}\n\nfunction turnAround(k) {\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction turnRight(k) {\n  k.turnLeft();\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction main(k) {\n  let more = true;\n  while (more) {\n    // Pick up this street's word, west to east.\n    let word = [];\n    while (k.beepersPresent()) {\n      word.push(takePile(k));\n      if (k.frontIsClear()) {\n        k.move();\n      }\n    }\n\n    // Lay it back down from the east wall: pop gives the last pile first.\n    while (k.frontIsClear()) {\n      k.move();\n    }\n    turnAround(k);\n    while (word.length > 0) {\n      putMany(k, word.pop());\n      if (word.length > 0) {\n        k.move();\n      }\n    }\n\n    // Back to the west wall, then up a street if there is one, facing east.\n    while (k.frontIsClear()) {\n      k.move();\n    }\n    turnRight(k);\n    more = k.frontIsClear();\n    if (more) {\n      k.move();\n    }\n    turnRight(k);\n  }\n}`,
      },
      {
        key: "complex2", label: "Complex II", points: 20,
        world: `Dimension: (4, 4)\nKarel: (1, 1); east\nBeeperBag: INFINITY\nBeeper: (2, 1); 1\nBeeper: (4, 1); 2\nBeeper: (2, 2); 2\nBeeper: (1, 3); 1\nBeeper: (3, 3); 3\nBeeper: (2, 4); 2\nBeeper: (4, 4); 1`,
        prompt: `<strong>Quarter turn.</strong> Rotate the whole field of piles 90&deg; <em>clockwise</em>, as if you turned the picture a quarter turn to the right: the pile in the south-west corner moves to the north-west corner, the north-west one to the north-east, and so on around. In an <em>n</em>&times;<em>n</em> world, the pile on (<em>a</em>, <em>s</em>) moves to (<em>s</em>, <em>n</em> + 1 &minus; <em>a</em>); here the pile on (2, 1) goes to (1, 3). Every pile moves at once, so pick the whole field up into a 2D array <code>grid</code> first (<code>grid[r][c]</code> for street <code>r + 1</code>, avenue <code>c + 1</code>), then put it back down rotated. Work out which <code>grid</code> cell belongs on each corner. Don't hard-code the size: your program should work for a square world of any size.`,
        starter: STUB, check: ["beepers"],
        solution: `// Pick up the whole pile on this corner and return its size.\nfunction takePile(k) {\n  let n = 0;\n  while (k.beepersPresent()) {\n    k.pickBeeper();\n    n++;\n  }\n  return n;\n}\n\nfunction turnAround(k) {\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction turnRight(k) {\n  k.turnLeft();\n  k.turnLeft();\n  k.turnLeft();\n}\n\n// Go back to the west wall and up one street, if there is one, facing east.\nfunction startNextRow(k) {\n  turnAround(k);\n  while (k.frontIsClear()) {\n    k.move();\n  }\n  turnRight(k);\n  if (k.frontIsClear()) {\n    k.move();\n  }\n  turnRight(k);\n}\n\nfunction main(k) {\n  // Pick up the field street by street. grid[r][c] is street r + 1, avenue c + 1.\n  let grid = [];\n  let more = true;\n  while (more) {\n    let row = [];\n    row.push(takePile(k));\n    while (k.frontIsClear()) {\n      k.move();\n      row.push(takePile(k));\n    }\n    grid.push(row);\n    more = k.leftIsClear();\n    startNextRow(k);\n  }\n\n  // Back down to (1, 1), facing east.\n  turnRight(k);\n  while (k.frontIsClear()) {\n    k.move();\n  }\n  k.turnLeft();\n\n  // Corner (r, c) of the rotated field comes from grid[c][n - 1 - r].\n  let n = grid.length;\n  for (let r = 0; r < n; r++) {\n    for (let c = 0; c < n; c++) {\n      for (let b = 0; b < grid[c][n - 1 - r]; b++) {\n        k.putBeeper();\n      }\n      if (k.frontIsClear()) {\n        k.move();\n      }\n    }\n    startNextRow(k);\n  }\n}`,
      },
    ],
  },

  14: {
    slug: "14-objects", title: "Objects",
    problems: [
      {
        key: "simple", label: "Simple", points: 5,
        world: `Dimension: (6, 4)\nKarel: (1, 1); east\nBeeperBag: INFINITY`,
        prompt: `Plant the flags. The starter holds an array of flag records. Each <code>flag</code> stands on avenue <code>flag.avenue</code>, rises from street 1, is <code>flag.height</code> corners tall, and is painted <code>flag.color</code>. Not every avenue gets a flag: the first flag is 2 Red corners on avenue 1, and avenue 2 stays blank. Loop over <code>flags</code> and read every avenue, height, and color from the records; don't type the four flags out by hand.`,
        starter: "function main(k) {\n  let flags = [\n    { avenue: 1, height: 2, color: \"Red\" },\n    { avenue: 3, height: 4, color: \"Blue\" },\n    { avenue: 4, height: 1, color: \"Yellow\" },\n    { avenue: 6, height: 3, color: \"Green\" },\n  ];\n  \n}\n", check: ["colors"],
        solution: `function turnAround(k) {\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction main(k) {\n  let flags = [\n    { avenue: 1, height: 2, color: "Red" },\n    { avenue: 3, height: 4, color: "Blue" },\n    { avenue: 4, height: 1, color: "Yellow" },\n    { avenue: 6, height: 3, color: "Green" },\n  ];\n  for (let flag of flags) {\n    // Walk from (1, 1) to the flag's avenue and climb it, painting flag.height corners.\n    for (let i = 1; i < flag.avenue; i++) {\n      k.move();\n    }\n    k.turnLeft();\n    for (let h = 0; h < flag.height; h++) {\n      k.paintCorner(flag.color);\n      if (h < flag.height - 1) {\n        k.move();\n      }\n    }\n    // Back down to street 1, then west to (1, 1), facing east.\n    turnAround(k);\n    while (k.frontIsClear()) {\n      k.move();\n    }\n    k.turnLeft();\n    k.turnLeft();\n    k.turnLeft();\n    while (k.frontIsClear()) {\n      k.move();\n    }\n    turnAround(k);\n  }\n}`,
      },
      {
        key: "moderate", label: "Moderate", points: 10,
        world: `Dimension: (5, 5)\nKarel: (1, 1); east\nBeeperBag: INFINITY\nBeeper: (2, 1); 2\nBeeper: (4, 1); 1\nBeeper: (2, 2); 3\nBeeper: (3, 2); 1\nBeeper: (5, 2); 2\nBeeper: (1, 3); 1\nBeeper: (2, 4); 4\nBeeper: (3, 4); 2\nBeeper: (4, 4); 1\nBeeper: (1, 5); 1\nBeeper: (5, 5); 2`,
        prompt: `<strong>The heaviest street.</strong> Find the street (row) of this 5&times;5 world that holds the most beepers in total, and paint every corner of that street <strong>Yellow</strong>. Every pile must still be where it was when you're done, so count each pile and put it back. Survey street by street, and keep the leader in one record: <code>let best = { street: 0, total: -1 };</code>. When a street beats <code>best.total</code>, replace the record with that street's number and total. When the survey is done, <code>best.street</code> tells Karel where to paint.`,
        starter: STUB, check: ["colors", "beepers"],
        solution: `// Count the pile on this corner, then put it back as it was.\nfunction countPile(k) {\n  let n = 0;\n  while (k.beepersPresent()) {\n    k.pickBeeper();\n    n++;\n  }\n  for (let i = 0; i < n; i++) {\n    k.putBeeper();\n  }\n  return n;\n}\n\nfunction turnAround(k) {\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction turnRight(k) {\n  k.turnLeft();\n  k.turnLeft();\n  k.turnLeft();\n}\n\n// Go back to the west wall and up one street, if there is one, facing east.\nfunction startNextRow(k) {\n  turnAround(k);\n  while (k.frontIsClear()) {\n    k.move();\n  }\n  turnRight(k);\n  if (k.frontIsClear()) {\n    k.move();\n  }\n  turnRight(k);\n}\n\nfunction main(k) {\n  let best = { street: 0, total: -1 };  // the heaviest street seen so far\n\n  // Survey street by street, keeping the record of the heaviest one.\n  for (let street = 1; street <= 5; street++) {\n    let total = countPile(k);\n    while (k.frontIsClear()) {\n      k.move();\n      total = total + countPile(k);\n    }\n    if (total > best.total) {\n      best = { street: street, total: total };\n    }\n    startNextRow(k);\n  }\n\n  // Karel is at (1, 5) facing east: drop down to best.street.\n  turnRight(k);\n  for (let s = 5; s > best.street; s--) {\n    k.move();\n  }\n  k.turnLeft();\n\n  // Paint the whole street.\n  k.paintCorner("Yellow");\n  while (k.frontIsClear()) {\n    k.move();\n    k.paintCorner("Yellow");\n  }\n}`,
      },
      {
        key: "complex", label: "Complex", points: 15,
        world: `Dimension: (6, 6)\nKarel: (1, 1); east\nBeeperBag: INFINITY\nBeeper: (2, 3); 1\nBeeper: (4, 2); 1\nBeeper: (5, 5); 1\nBeeper: (3, 4); 1`,
        prompt: `<strong>Draw the bounding box.</strong> A few beepers are scattered around this world. Find the smallest rectangle that contains all of them and paint its edge <strong>Yellow</strong>: every corner on its west, east, south, and north sides, including corners that hold a beeper. Leave the beepers where they are. Keep the rectangle in one object, <code>{ west, east, south, north }</code>, and widen it each time Karel finds a beeper outside it; here it ends as <code>{ west: 2, east: 5, south: 2, north: 5 }</code>. Karel can't feel where it is, so keep its position in a <code>pos = { avenue, street }</code> object and have your stepping helper update <code>pos</code> on every move. Make one pass to build the box and a second to paint its edge.`,
        starter: STUB, check: ["colors", "beepers"],
        solution: `function turnAround(k) {\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction turnRight(k) {\n  k.turnLeft();\n  k.turnLeft();\n  k.turnLeft();\n}\n\n// Step to the next corner, west to east and then up a row, keeping pos up to date.\n// Returns false (facing east on the top row's west end) when no corners are left.\nfunction nextCorner(k, pos) {\n  if (k.frontIsClear()) {\n    k.move();\n    pos.avenue++;\n    return true;\n  }\n  turnAround(k);\n  while (k.frontIsClear()) {\n    k.move();\n  }\n  turnRight(k);\n  if (!k.frontIsClear()) {\n    turnRight(k);\n    return false;\n  }\n  k.move();\n  turnRight(k);\n  pos.avenue = 1;\n  pos.street++;\n  return true;\n}\n\n// From the west wall facing east, return to (1, 1) facing east.\nfunction goHome(k) {\n  turnRight(k);\n  while (k.frontIsClear()) {\n    k.move();\n  }\n  k.turnLeft();\n}\n\n// Is this corner on the edge of the box?\nfunction onBorder(box, pos) {\n  let inColumns = pos.avenue >= box.west && pos.avenue <= box.east;\n  let inRows = pos.street >= box.south && pos.street <= box.north;\n  let onSide = pos.avenue === box.west || pos.avenue === box.east;\n  let onEnd = pos.street === box.south || pos.street === box.north;\n  return (onSide && inRows) || (onEnd && inColumns);\n}\n\nfunction main(k) {\n  // Pass one: grow the box to take in every beeper. It starts inside out,\n  // so the first beeper found sets all four sides.\n  let box = { west: 1000, east: 0, south: 1000, north: 0 };\n  let pos = { avenue: 1, street: 1 };\n  let more = true;\n  while (more) {\n    if (k.beepersPresent()) {\n      if (pos.avenue < box.west) {\n        box.west = pos.avenue;\n      }\n      if (pos.avenue > box.east) {\n        box.east = pos.avenue;\n      }\n      if (pos.street < box.south) {\n        box.south = pos.street;\n      }\n      if (pos.street > box.north) {\n        box.north = pos.street;\n      }\n    }\n    more = nextCorner(k, pos);\n  }\n\n  // Pass two: paint the box's edge.\n  goHome(k);\n  pos = { avenue: 1, street: 1 };\n  more = true;\n  while (more) {\n    if (onBorder(box, pos)) {\n      k.paintCorner("Yellow");\n    }\n    more = nextCorner(k, pos);\n  }\n}`,
      },
      {
        key: "complex2", label: "Complex II", points: 20,
        world: `Dimension: (7, 1)\nKarel: (1, 1); east\nBeeperBag: INFINITY\nColor: (2, 1); Red\nColor: (3, 1); Orange\nColor: (4, 1); Yellow\nColor: (5, 1); Green\nColor: (6, 1); Blue\nColor: (7, 1); Cyan\nBeeper: (2, 1); 3\nBeeper: (3, 1); 1\nBeeper: (4, 1); 4\nBeeper: (5, 1); 1\nBeeper: (6, 1); 2`,
        prompt: `<strong>Sort the row.</strong> Karel starts on a blank corner at the west end of the bottom row. Every corner east of it is painted, and most hold a pile. Rearrange those corners so the piles go from smallest on avenue 2 to biggest at the east wall, with each corner's <em>color traveling with its pile</em>. When two piles are the same size, keep them in the order they started in. Here avenues 2 to 7 end Cyan-0, Orange-1, Green-1, Blue-2, Red-3, Yellow-4, and Karel's corner stays blank. Record each corner as <code>{ color, size }</code> while you pick the row up, then lay the records back down in sorted order. Don't hard-code the width or the sizes. (One way: find the biggest size, then for each size from 0 up to it, lay down every record of exactly that size.)`,
        starter: `// Return the name of this corner's color.\nfunction readColor(k) {\n  let candidates = ["Red", "Orange", "Yellow", "Green", "Blue", "Cyan", "Magenta", "Pink"];\n  for (let i = 0; i < candidates.length; i++) {\n    if (k.cornerColorIs(candidates[i])) {\n      return candidates[i];\n    }\n  }\n  return "";\n}\n\n// Pick up the whole pile on this corner and return its size.\nfunction takePile(k) {\n  let n = 0;\n  while (k.beepersPresent()) {\n    k.pickBeeper();\n    n++;\n  }\n  return n;\n}\n\nfunction turnAround(k) {\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction main(k) {\n  \n}\n`, check: ["colors", "beepers"],
        solution: `// Return the name of this corner's color.\nfunction readColor(k) {\n  let candidates = ["Red", "Orange", "Yellow", "Green", "Blue", "Cyan", "Magenta", "Pink"];\n  for (let i = 0; i < candidates.length; i++) {\n    if (k.cornerColorIs(candidates[i])) {\n      return candidates[i];\n    }\n  }\n  return "";\n}\n\n// Pick up the whole pile on this corner and return its size.\nfunction takePile(k) {\n  let n = 0;\n  while (k.beepersPresent()) {\n    k.pickBeeper();\n    n++;\n  }\n  return n;\n}\n\nfunction turnAround(k) {\n  k.turnLeft();\n  k.turnLeft();\n}\n\nfunction main(k) {\n  // Record every corner east of the start as { color, size }, picking the piles up.\n  let row = [];\n  while (k.frontIsClear()) {\n    k.move();\n    row.push({ color: readColor(k), size: takePile(k) });\n  }\n\n  let biggest = 0;\n  for (let corner of row) {\n    if (corner.size > biggest) {\n      biggest = corner.size;\n    }\n  }\n\n  // Back to the west wall, facing east.\n  turnAround(k);\n  while (k.frontIsClear()) {\n    k.move();\n  }\n  turnAround(k);\n\n  // Lay the records down smallest first. Records of the same size keep their order.\n  for (let size = 0; size <= biggest; size++) {\n    for (let corner of row) {\n      if (corner.size === size) {\n        k.move();\n        k.paintCorner(corner.color);\n        for (let b = 0; b < corner.size; b++) {\n          k.putBeeper();\n        }\n      }\n    }\n  }\n}`,
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
        world: `Dimension: (5, 1)\nKarel: (1, 1); east\nBeeperBag: 0\nBeeper: (2, 1); 1\nBeeper: (3, 1); 1\nBeeper: (4, 1); 1\nBeeper: (5, 1); 1`,
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
        world: `Dimension: (5, 1)\nKarel: (1, 1); east\nBeeperBag: 0\nBeeper: (2, 1); 1\nBeeper: (3, 1); 1\nBeeper: (5, 1); 1`,
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
  const total = nums.reduce((sum, n) => sum + LESSONS[n].problems.length, 0);
  if (checkOnly) {
    console.log(`\nAll ${total} problems verified (--check: nothing written).`);
    return;
  }
  for (const n of nums) {
    const id = `lesson-${pad(n)}`;
    const path = join(ROOT, "assignments", `${id}.js`);
    writeFileSync(path, emitManifest(n, LESSONS[n]));
    console.log(`  wrote assignments/${id}.js`);
  }
  console.log(`\nGenerated ${nums.length} lesson manifests (${total} problems).`);
}

main();
