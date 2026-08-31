---
name: maintain-assignments
description: Add, edit, or verify Karel coursework under assignments/ and tools/ — a new problem on a lesson assignment, a new standalone assignment, a changed world/prompt/solution/check, re-sealing a solution, or a grading question. Use whenever the request touches assignments/*.js, tools/gen-lesson-assignments.js, tools/seal.js, tools/grade.js, or the assignment pages, and before hand-editing any assignments/lesson-NN.js (those are generated).
---

# Maintaining assignments

Read `CLAUDE.md` → "Assignments & grading" first for the invariants. This skill
is the *procedure*: what to edit, in what order, and how to prove it works.

## The one rule that breaks things

`assignments/lesson-01.js` … `lesson-18.js` are **generated**. Never hand-edit
them — edit `tools/gen-lesson-assignments.js` (which holds the **plaintext**
solutions in `LESSONS[n]`) and rerun the generator. A hand-edit is silently
reverted by the next regeneration, and the sealed solution will stop matching
the plaintext one that is supposed to be its source of truth.

`assignments/collect-all.js` (and any other standalone assignment) *is*
hand-written — those you edit directly, re-sealing the solution yourself.

## Adding a problem to a lesson assignment

1. **Edit `tools/gen-lesson-assignments.js`**, in `LESSONS[<n>].problems`. A
   problem is:

   ```js
   {
     key: "complex2", label: "Complex II", points: 20,
     world: `Dimension: (8, 8)\nKarel: (1, 1); east\n…`,
     prompt: `HTML shown to the student`,
     starter: STUB, check: ["beepers"],
     // end: { avenue: 6, street: 7, direction: "east" },   // optional pinned pose
     solution: `function main(k) { … }`,   // PLAINTEXT here; sealed on the way out
   }
   ```

   - **`key` must be unique within the lesson.** The three standard problems are
     `simple` / `moderate` / `complex`; an extra one gets its own key
     (`lesson-02` uses `complex2`). The key is a map key in the grader
     (`perProblem[key]`), the localStorage key on the student page, and the
     badge CSS class — a duplicate silently clobbers.
   - **`points`** are summed into the manifest's `points` total by the emitter.
   - **`check`** picks the aspects compared against the solution's end state:
     `"beepers"`, `"position"`, `"direction"`, `"colors"` (default is all four).
     **Only check what the prompt actually demands.** Including `"position"` on
     an open-ended task fails every student who took a different-but-correct
     route; leave it out unless the prompt pins where Karel finishes.
   - **`starter`** seeds the editor. Use `STUB` when the student should write the
     helpers themselves; give named empty helpers only when the prompt hands
     them the decomposition.
   - **`solution` must respect the lesson's vocabulary.** Lesson 2 has no `if`
     and no loops, so a lesson-2 solution is straight-line calls only. Check
     `lessons/NN-*.html` for what has been taught by that point.

2. **Regenerate and verify:**

   ```bash
   node tools/gen-lesson-assignments.js --check   # verify only, writes nothing
   node tools/gen-lesson-assignments.js           # write the manifests
   git status --porcelain assignments/            # expect ONLY the lesson you touched
   ```

   The generator verifies every problem: the solution must run cleanly and match
   itself under `check`, the starter must compile, and the starter must **not**
   already solve. A trivially-satisfiable problem fails the run.

3. **Update the surfaces that state a count or a total:**
   - `assignments/index.html` — the row's `<span class="desc">` and `<span
     class="pts">`. This list is deliberately static HTML; keep it in sync by hand.
   - `lessons/NN-*.html` — the `.assign-cta` link text ("… (N problems)").
   - `assignments/assignment.html` — add a `.chal-badge.level-<key>` color rule
     if the key is new, next to the `level-simple/moderate/complex` rules.

   The renderer, the `problem_<n>` submission framing, and `tools/grade.js`
   scoring are all count-agnostic — no code changes needed for an extra problem.

## Adding a standalone assignment

Mirror `assignments/collect-all.js`:

1. Write the plaintext solution to a scratch file, then
   `node tools/seal.js sol.js --check` (`--check` prints the round-trip).
2. Create `assignments/<id>.js` with `id`, `title`, `points`, `world`, `prompt`,
   `starter`, `check`, optional `end`, and the **sealed** `solution`. Keep the
   plaintext solution in the JSDoc header comment so it stays re-derivable.
3. Re-export it from `assignments/index.js` **and** add it to the `assignments`
   array — that array is what `tools/grade.js` grades.
4. Add a `<li>` to the static list in `assignments/index.html`.
5. No new HTML page: `assignments/assignment.html?id=<id>` is generic.

## Editing an existing problem

- Lesson problem → edit the generator, rerun it, re-check the surfaces above.
- Standalone → edit the module; if the solution changed, **re-seal it**
  (`node tools/seal.js`) — the browser goal GIF and the CLI grade both come
  from the sealed string, so a stale seal grades the old answer.
- Changing a `world` or `check` invalidates saved student work in localStorage
  (`karel-assignment:<id>:<key>`) only in the sense that it may no longer pass;
  the code itself is preserved. Say so if the change lands mid-term.

## Verifying without a browser

Grade any problem headlessly — this is the same path `tools/grade.js` uses:

```bash
node -e "
import('./assignments/index.js').then(async m => {
  const k = await import('./stanfordkarel.js');
  const a = m.getAssignment('lesson-02');
  const p = a.problems.find(p => p.key === 'complex2');
  const sol = k.unsealSolution(p.solution);
  console.log('solution:', await k.gradeKarel(p.world, sol, { solution: sol, check: p.check, end: p.end }));
  console.log('starter solves?', (await k.gradeKarel(p.world, p.starter, { solution: sol, check: p.check, end: p.end })).solved);
});"
```

Expect `solved: true` for the solution and `false` for the starter. `gradeKarel`
has **no frame cap** — never run it on student code without a timeout wrapper
(that is why `tools/grade.js` spawns `tools/grade-worker.js` per submission).

Batch-grade against a scratch repo holding a right and a wrong submission:

```bash
node tools/grade.js --roster <local.json> --no-pull --timeout 5000
```

A roster entry's `repoUrl` may be a local directory, which is used in place.

## Browser check (do this for anything student-facing)

```bash
npx serve .    # or: python3 -m http.server
```

Open `assignments/assignment.html?id=<id>`: the goal GIF builds for every
problem, a correct answer gives ✓, Copy submission emits a `problem_<n>` wrapper
per problem, and work survives a reload. ES module imports need `http://`, not
`file://`.

## Submission shape (what the grader unwraps)

```js
// assignment: lesson-02
function problem_1() { …student code…; return main; }
function problem_4() { …student code…; return main; }
```

`n` is the problem's **1-based position in the `problems` array**, not its key —
so reordering problems renames every wrapper and orphans in-flight submissions.
Append new problems at the end rather than inserting in the middle.
