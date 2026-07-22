# Memory Bank — shared reference

Shared definitions for the Memory Bank skills
([create-decision](../create-decision/SKILL.md),
[create-lesson-learned](../create-lesson-learned/SKILL.md)). This file is
**not** a skill — the skills link here so the policy exists exactly once.

## Levels

A Memory Bank **level** is a directory subtree with its own
`docs/decisions/` and `docs/learnings/`, each with its own `README.md`
index.

- The **repo root** is the suite level: cross-cutting decisions, process
  decisions, repo-wide baselines.
- **`apps/<app>/`** and **`services/<service>/`** are app levels: records
  that concern only that app or service.
- There is **no hard-coded list of levels.** Any directory becomes a level
  when the placement rule selects it — e.g. `services/` for a decision
  affecting several backend services. This keeps the skills repo-agnostic;
  a repo whose records all live at the root simply has one level.

## Placement rule

> A record lives on the smallest level whose subtree contains everyone affected.

Cross-cutting / process / repo-wide baselines → repo root. Anything that
affects a single app → that app's directory. Several sibling services →
their common parent (e.g. `services/`).

## Delta principle

A record that specializes or deviates from a record on a higher level
**links that record** in its *Context and problem* section. Never duplicate
higher-level content on a lower level.

## Before creating: check the other levels

A new record starts with a search, not a template: check the proposed
level, every level above it, and sibling apps/services for an existing
record on the same topic. A hit on a higher level is specialized via the
delta principle instead of restated; a hit in a sibling means the topic
is broader than one app — promote it (see below) instead of duplicating
it.

## Promotion

When a record turns out to matter beyond its level (e.g. a sibling app
faces the same question), do not move the file. Create a new record on
the smallest level that covers everyone now affected, and set the old
record's status to `Superseded by <new record's filename without .md>` —
the same supersede mechanism used for any revised decision.

## Significance triage

A decision deserves a Decision Record only if **at least one** criterion
applies:

1. **Structural impact** — it affects structure, interfaces, dependencies,
   or quality attributes (security, performance, accessibility, …).
2. **Hard to reverse** — undoing it would be expensive or risky.
3. **Precedent** — it sets a first-of-a-kind pattern future code should
   follow.
4. **Cross-cutting** — it spans features, apps, or teams.

If none applies, **no Decision Record** is created. Route instead:

| What it actually is | Route |
|---|---|
| Recurring "how we write code" rule | Convention in `.claude/rules/` (written manually: short rule + example + optional `paths:` frontmatter) |
| Observation / pitfall | `/create-lesson-learned` |
| One-off local design choice | Stays in the spec / PR description — no record |

The criteria are fixed and changed only by the Hüter-Trio (like the
category list). Lessons Learned have **no** significance gate — they are
deliberately low-threshold.

**Generalize.** When a decision passes as a precedent, record the
generalizable pattern, not the single instance ("cross-feature
communication via an owner-side bridge store", not "the toolbar↔editor
store"). The second application of an established pattern gets no new
record — it follows the existing one.

## Boundaries

- **Conventions stay central** in `.claude/rules/` — auto-loading only
  works there; their scoping is the `paths:` frontmatter, not the
  directory location.
- Skills **never move existing records** between levels. Migrating legacy
  records is a project of the affected repo, not a skill action.
- Every level maintains **only its own index** (`README.md`); never
  aggregate indexes across levels.
