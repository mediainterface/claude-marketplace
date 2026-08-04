# Memory Bank — shared reference

Shared definitions for the Memory Bank skills
([create-decision](../create-decision/SKILL.md),
[create-lesson-learned](../create-lesson-learned/SKILL.md)). This file is
**not** a skill — the skills link here so the policy exists exactly once.

## Levels

A Memory Bank **level** is a directory subtree with its own
`docs/decisions/` and `docs/learnings/`, each with its own `README.md`
index.

- The **repo root** is the suite level: decisions spanning multiple
  apps/services, process decisions, repo-wide baselines.
- **`apps/<app>/`** and **`services/<service>/`** are app levels: records
  that concern only that app or service.
- There is **no hard-coded list of levels.** Any directory becomes a level
  when the placement rule selects it — e.g. `services/` for a decision
  affecting several backend services. This keeps the skills repo-agnostic;
  a repo whose records all live at the root simply has one level.

## Placement rule

> A record lives on the smallest level whose subtree contains everyone affected.

Spanning multiple apps or services / process / repo-wide baselines → repo
root. Anything that affects a single app → that app's directory — **even
when it spans several features inside that app** (significance criterion 4
can be met by a feature-spanning decision; significance and placement are
independent questions). Several sibling services → their common parent
(e.g. `services/`).

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

### Evidence required

A criterion is met only when its evidence can be **named** — in one line,
concretely, from this codebase. Without a nameable piece of evidence the
criterion is **not** met, however plausible it reads:

| Criterion | Name this |
|---|---|
| Structural impact | which **existing pattern changes**. An interface that follows the project's established pattern (a feature slice, the usual IPC/route layout) *applies* an existing decision — it does not make a new one. |
| Hard to reverse | what a **revert costs** (files, migrations, released data, other teams). |
| Precedent | the **second place that exists today** which would have to follow the rule, or whom the rule binds. "If there are ever several" does not count. |
| Cross-cutting | the concrete **features / apps / teams**. |

### Locality counter-check

This applies **even when a criterion was answered yes**: if the behavior
sits in **one place**, is confined to **one feature**, and a revert is
**cheap**, there is **no record** — the reasoning belongs in a comment at
the code. The four criteria are or-ed; this counter-check is not, it
overrides a formally ticked criterion.

If none applies — or the counter-check bites — **no Decision Record** is
created. Route instead:

| What it actually is | Route |
|---|---|
| Recurring "how we write code" rule | Convention in `.claude/rules/` (written manually: short rule + example + optional `paths:` frontmatter) |
| Observation / pitfall | `/create-lesson-learned` |
| One-off local design choice | Stays in the spec / PR description — no record |

The criteria are fixed and changed only by the Hüter-Trio (like the
category list). Lessons Learned have **no** significance gate — they are
deliberately low-threshold.

### Examples

**No record** — formally tickable, still local: global hotkeys are suspended
while a UI recorder is recording. Claimed *structural impact* (the feature
adds two IPC channels) and *precedent* (future recorders should behave the
same). Neither survives the evidence question: the channels follow the app's
established feature-slice pattern, so they apply an existing decision instead
of changing one, and there is exactly **one** recorder — the second place was
speculation, not a place. The behavior sits at one spot and a revert is one
line → a comment at the code.

**Record** — cross-feature communication runs through an owner-side bridge
store. *Structural impact*: it replaces the direct store imports features
used before. *Precedent*: toolbar↔editor and session-list↔player both exist
today and both have to follow it.

### Where the triage runs

The triage runs where a record is **first proposed** — including a spec's
*Memory Bank* section, not only when `/create-decision` creates the file. A
spec proposal states the criterion **with its evidence**; a record already
written out in a spec makes the later gate a rubber stamp.

### Generalize

When a decision passes as a precedent, record the
generalizable pattern, not the single instance ("cross-feature
communication via an owner-side bridge store", not "the toolbar↔editor
store"). The second application of an established pattern gets no new
record — it follows the existing one.

## Boundaries

- **Conventions stay central** in the repo-root `.claude/rules/` — a
  deliberate policy, not a technical limit: a nested `.claude/rules/`
  would load only on demand per subtree (like a nested `CLAUDE.md`),
  which we avoid for conventions that must be in scope suite-wide in
  every session. Their scoping is the `paths:` frontmatter, not the
  directory location.
- Skills **never move existing records** between levels. Migrating legacy
  records is a project of the affected repo, not a skill action.
- Every level maintains **only its own index** (`README.md`); never
  aggregate indexes across levels.
