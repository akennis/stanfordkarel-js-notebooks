/**
 * Bundled Karel worlds.
 *
 * Each world is exported as a plain-text string in the same `.w` format
 * accepted by `runKarel`. Import one directly:
 *
 *   import { square } from "./worlds/index.js";
 *   animation = karel.runKarel(square, main);
 *
 * or grab the whole collection:
 *
 *   import * as worlds from "./worlds/index.js";
 *   animation = karel.runKarel(worlds.square, main);
 */
export { square } from "./square.js";
