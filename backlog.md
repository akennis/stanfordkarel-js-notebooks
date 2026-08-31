# Backlog

Known issues and cleanups deferred to a later session. Delete an entry when it
is fixed.

## Stale `tools/grade-lessons.js` references in comments

Three JSDoc comments name a `tools/grade-lessons.js` that does not exist. The
teacher-side grader is `tools/grade.js`, which handles **both** manifest shapes
(it scores a lesson assignment by summing `perProblem` points via
`scoreResult`); there is no separate lesson grader.

Occurrences:

- `assignments/index.js:16` — "the teacher graders (tools/grade.js, tools/grade-lessons.js)"
- `assignments/assignment.js:8` — "teacher-side re-grade (tools/grade-lessons.js)"
- `tools/gen-lesson-assignments.js:20` — "(tools/grade-lessons.js) re-runs each framed problem"

Fix: point all three at `tools/grade.js` (and drop the plural "graders" in
`assignments/index.js`). Comments only — no behavior change, no regeneration
needed. Line numbers are as of this writing; re-grep `grade-lessons` before
editing.
