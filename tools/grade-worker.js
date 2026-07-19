/**
 * grade-worker.js — runs a single submission's grade in its own thread.
 *
 * tools/grade.js spawns one of these per submission so a runaway student program
 * (an infinite loop) can be killed with worker.terminate() after a timeout
 * instead of hanging the whole grading run. The parent passes everything as
 * plain data (workerData); we recompile the program text here and report only
 * the verdict.
 */
import { parentPort, workerData } from "node:worker_threads";
import { gradeKarel } from "../stanfordkarel.js";

const { worldText, programText, solutionText, check, end } = workerData;

gradeKarel(worldText, programText, { solution: solutionText, check, end })
  .then(result => parentPort.postMessage(result))
  .catch(err => parentPort.postMessage({ solved: false, state: null, error: err.message || String(err) }));
