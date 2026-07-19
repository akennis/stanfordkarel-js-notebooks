#!/usr/bin/env node
/**
 * seal.js — authoring helper for assignment solutions.
 *
 * An assignment module (assignments/<id>.js) stores its reference solution as a
 * *sealed* string so it isn't shipped to the browser in plaintext. This tool
 * turns a plaintext solution file into that sealed string.
 *
 * Usage:
 *   node tools/seal.js path/to/solution.js
 *   node tools/seal.js path/to/solution.js --check   # also print the round-trip
 *
 * The solution file is ordinary Karel program source that defines main(), e.g.
 *
 *   function main(k) {
 *     while (k.frontIsClear()) k.move();
 *   }
 *
 * Copy the printed string into the assignment's `solution:` field. Sealing is
 * obfuscation, not encryption (see stanfordkarel.js) — the authoritative grade
 * is the headless re-grade in tools/grade.js.
 */
import { readFileSync } from "node:fs";
import { sealSolution, unsealSolution, compileProgram } from "../stanfordkarel.js";

const [, , file, ...flags] = process.argv;
if (!file) {
  console.error("Usage: node tools/seal.js <solution.js> [--check]");
  process.exit(1);
}

const src = readFileSync(file, "utf8");

// Fail loudly on a solution that won't compile — better to catch it here than
// to ship a broken goal to students.
try {
  compileProgram(src);
} catch (err) {
  console.error(`Solution does not compile: ${err.message}`);
  process.exit(1);
}

const sealed = sealSolution(src);
console.log(sealed);

if (flags.includes("--check")) {
  const ok = unsealSolution(sealed) === src;
  console.error(ok ? "\n✓ round-trip verified" : "\n✗ round-trip MISMATCH");
  if (!ok) process.exit(1);
}
