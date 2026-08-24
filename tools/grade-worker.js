/**
 * grade-worker.js — runs a single submission's grade in its own thread.
 *
 * tools/grade.js spawns one of these per submission so a runaway student program
 * (an infinite loop) can be killed with worker.terminate() after a timeout
 * instead of hanging the whole grading run. The parent passes everything as
 * plain data (workerData); we recompile the program text here and report only
 * the verdict.
 *
 * Two payload shapes, matching the two assignment shapes:
 *   - single:  { worldText, programText, solutionText, check, end }
 *              → posts one gradeKarel result. The program may be a bare main(k)
 *                or the `function problem_1()` framing assignment.html emits.
 *   - multi:   { programText, problems: [{ key, worldText, solutionText, check, end }] }
 *              → the submission frames each problem as `function problem_<n>()`
 *                (numbered by position, 1-based) that returns its main(k); we
 *                unwrap each and grade it, posting { perProblem: { <key>: result, … } }.
 */
import { parentPort, workerData } from "node:worker_threads";
import { gradeKarel } from "../stanfordkarel.js";

// Pull the main() a student framed as `function problem_<n>() { …; return main; }`
// out of the whole submission source — `n` is the problem's 1-based position in
// the assignment. Returns the main function, or throws a friendly error if the
// wrapper (or its main) is missing.
function unframe(programText, n) {
  const factory = new Function(
    `"use strict";\n${programText}\n;` +
    `return typeof problem_${n} === "function" ? problem_${n} : null;`
  );
  const wrapper = factory();
  if (typeof wrapper !== "function")
    throw new Error(`missing function problem_${n}()`);
  const main = wrapper();
  if (typeof main !== "function")
    throw new Error(`problem_${n}() did not return a main function`);
  return main;
}

// A standalone (single-problem) submission copied from assignment.html is framed
// the same way a lesson's is — one `function problem_1()` wrapper — while a
// hand-written one is just a main(k). Prefer the top-level main(), fall back to
// unwrapping problem_1, so both shapes grade.
function mainFromSingle(programText) {
  const factory = new Function(
    `"use strict";\n${programText}\n;` +
    `return { main: typeof main === "function" ? main : null,` +
    ` wrapper: typeof problem_1 === "function" ? problem_1 : null };`
  );
  const { main, wrapper } = factory();
  if (typeof main === "function") return main;
  if (typeof wrapper === "function") {
    const unwrapped = wrapper();
    if (typeof unwrapped !== "function")
      throw new Error("problem_1() did not return a main function");
    return unwrapped;
  }
  throw new ReferenceError("Program must define a function called main, e.g. function main(k) { … }");
}

async function gradeMulti({ programText, problems }) {
  const perProblem = {};
  for (const [i, p] of problems.entries()) {
    try {
      const main = unframe(programText, i + 1);
      perProblem[p.key] = await gradeKarel(p.worldText, main,
        { solution: p.solutionText, check: p.check, end: p.end });
    } catch (err) {
      perProblem[p.key] = { solved: false, state: null, error: err.message || String(err) };
    }
  }
  return { perProblem };
}

async function run() {
  if (Array.isArray(workerData.problems)) return gradeMulti(workerData);
  const { worldText, programText, solutionText, check, end } = workerData;
  return gradeKarel(worldText, mainFromSingle(programText), { solution: solutionText, check, end });
}

run()
  .then(result => parentPort.postMessage(result))
  .catch(err => parentPort.postMessage({ solved: false, state: null, error: err.message || String(err) }));
