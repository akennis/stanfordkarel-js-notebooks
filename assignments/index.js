/**
 * Bundled Karel assignments.
 *
 * Each assignment is a manifest object (world, prompt, starter, graded aspects,
 * and a *sealed* reference solution — see assignments/collect-all.js). Both the
 * student page (assignments/assignment.html) and the teacher grader
 * (tools/grade.js) import from here, so this is the single source of truth for
 * which assignments exist.
 *
 *   import { assignments, getAssignment } from "./assignments/index.js";
 *   const a = getAssignment("collect-all");
 *
 * To add an assignment: create assignments/<id>.js, re-export it below, and add
 * it to the `assignments` array. See CLAUDE.md → "Adding an assignment".
 */
export { collectAll } from "./collect-all.js";

import { collectAll } from "./collect-all.js";

/** All assignments, in the order they should appear on the index page. */
export const assignments = [collectAll];

/** Look up an assignment manifest by its `id`, or undefined if none matches. */
export function getAssignment(id) {
  return assignments.find(a => a.id === id);
}
