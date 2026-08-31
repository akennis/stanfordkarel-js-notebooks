# Project skills

Skills in this directory are **project-scoped**: they load for anyone running
Claude Code in this repo (they live in git, unlike `~/.claude/skills`, which is
personal). A skill is a folder holding a `SKILL.md`:

```
.claude/skills/<kebab-case-name>/SKILL.md
```

`SKILL.md` starts with YAML frontmatter and is followed by the instructions:

```markdown
---
name: my-skill
description: One line saying WHAT it does and WHEN to use it — this is all the
  model sees when deciding whether to load the skill, so name the triggers.
---

Body: the procedure, in the order it should be followed.
```

Conventions for this repo:

- **`name` must match the directory name** and is what the user types as
  `/my-skill`.
- **Write the `description` for retrieval.** It is the only part always in
  context. Lead with the action, then list the trigger phrases and file paths
  that should pull it in.
- **Put durable, repo-wide conventions in `CLAUDE.md`, procedures here.**
  `CLAUDE.md` is loaded every session and should stay short; a skill is loaded
  on demand and can afford checklists, commands, and worked examples.
- **Reference real commands and paths**, and keep them current — a skill that
  names a flag that no longer exists is worse than no skill.
- Supporting files (scripts, templates) can sit beside `SKILL.md` in the skill
  folder; refer to them by relative path from the repo root.

Current skills:

| Skill | Use it when |
|---|---|
| [`maintain-assignments`](./maintain-assignments/SKILL.md) | Adding, editing, or verifying anything under `assignments/` or `tools/` — problems, solutions, sealing, grading. |
