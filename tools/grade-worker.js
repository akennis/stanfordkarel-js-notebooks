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
 *              → posts one gradeKarel result.
 *   - multi:   { programText, problems: [{ key, worldText, solutionText, check, end }] }
 *              → the submission frames each problem as `function problem_<key>()`
 *                that returns its main(k); we unwrap each and grade it, posting
 *                { perProblem: { <key>: result, … } }.
 */
import { parentPort, workerData } from "node:worker_threads";
import { gradeKarel } from "../stanfordkarel.js";

// Pull the main() a student framed as `function problem_<key>() { …; return main; }`
// out of the whole submission source. Returns the main function, or throws a
// friendly error if the wrapper (or its main) is missing.
function unframe(programText, key) {
  const factory = new Function(
    `"use strict";\n${programText}\n;` +
    `return typeof problem_${key} === "function" ? problem_${key} : null;`
  );
  const wrapper = factory();
  if (typeof wrapper !== "function")
    throw new Error(`missing function problem_${key}()`);
  const main = wrapper();
  if (typeof main !== "function")
    throw new Error(`problem_${key}() did not return a main function`);
  return main;
}

async function gradeMulti({ programText, problems }) {
  const perProblem = {};
  for (const p of problems) {
    try {
      const main = unframe(programText, p.key);
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
  return gradeKarel(worldText, programText, { solution: solutionText, check, end });
}

run()
  .then(result => parentPort.postMessage(result))
  .catch(err => parentPort.postMessage({ solved: false, state: null, error: err.message || String(err) }));
