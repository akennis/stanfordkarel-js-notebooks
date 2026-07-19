/**
 * Assignment "collect-all" — Collect Every Beeper.
 *
 * A straight east–west corridor lined with one beeper per corner. The student
 * walks the corridor picking up every beeper and stops at the far wall. Graded
 * on the final beeper layout (all gone) and Karel's ending avenue/street.
 *
 * An assignment manifest mirrors a lesson "challenge" cell (see lessons/lesson.js)
 * but stores its reference `solution` *sealed* (see tools/seal.js) so the page
 * never ships the answer in plaintext. Re-seal with:
 *   node tools/seal.js <plaintext-solution.js>
 * The plaintext this was sealed from:
 *   function main(k) {
 *     while (true) {
 *       while (k.beepersPresent()) k.pickBeeper();
 *       if (!k.frontIsClear()) break;
 *       k.move();
 *     }
 *   }
 */
export const collectAll = {
  id: "collect-all",
  title: "Collect Every Beeper",
  points: 10,
  world: `
Dimension: (7, 1)
Karel: (1, 1); east
BeeperBag: 0
Beeper: (1, 1); 1
Beeper: (2, 1); 1
Beeper: (3, 1); 1
Beeper: (4, 1); 1
Beeper: (5, 1); 1
Beeper: (6, 1); 1
Beeper: (7, 1); 1
`,
  prompt:
    `Karel is standing at the west end of a corridor with a beeper on every ` +
    `corner. Walk east to the wall, picking up <strong>every</strong> beeper ` +
    `along the way. Karel should finish standing on the last corner.`,
  starter: "function main(k) {\n  \n}\n",
  check: ["beepers", "position"],
  end: { avenue: 7, street: 1 },
  solution:
    "DRQcBhhEDB0RXVcIQ1sOSEwebg1WRgMIHgBMBRcBRFUfQVZ5RUFMRRNFH10OQVoOQk8GFkFVRBJ9AQASCQsQBV8YSwpcFQVOCDFUVUYEX1tMWmZFRA1WWA1BWkQHAwUBXl5CKF4wCQQNF0wEXxEJExcEBxZpUxEQFgoDHgoXCU1NFnwRSxx4GGY=",
};

export default collectAll;
