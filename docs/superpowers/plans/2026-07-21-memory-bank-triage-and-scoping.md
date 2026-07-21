# Memory Bank Triage Gate + Multi-Level Scoping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/create-decision` gets a hard significance gate, decisions/learnings get placed on Memory Bank *levels* (repo root vs. app/service subtrees), and the guardian review skill sees and sanity-checks all levels.

**Architecture:** All policy prose lives in a new shared reference `plugins/sdd-kit/skills/memory-bank-shared/REFERENCE.md` (same pattern as `ado-shared/REFERENCE.md`); the two create-skills link to it, the SessionStart policy (`sdd-policy.md`) carries a compact summary so Claude filters at *proposal* time. The guardian plugin (separate plugin — no cross-plugin file links) gets its own mechanical path-glob update.

**Tech Stack:** Markdown skill files, one Markdown hook-payload file, JSON manifests. No executable code changes (the Node hook script stays untouched — it just reads `sdd-policy.md`).

**Spec:** `docs/superpowers/specs/2026-07-21-memory-bank-triage-and-scoping-design.md` (approved 2026-07-21).

## Global Constraints

- Work on branch `dev/memory-bank-triage-scoping` in the worktree `.worktrees/dev/memory-bank-triage-scoping/` — **never commit to `main`**. All paths below are relative to that worktree root.
- Commit format: `<emoji> <type>(<scope>): <description>` (Conventional Commits with emoji prefix), one commit per task.
- All new/edited skill and reference prose is **English** (matching every existing SKILL.md in this repo). German only where already present (e.g. *Aufgabe*, *Hüter-Trio*).
- The Decision-Record **template and filename schema stay unchanged**: `YYYY-MM-DD-kebab-case-title.md`, title portion max 80 chars, no new frontmatter fields (no `scope:` field — the directory encodes the scope).
- Skills must stay **repo-agnostic** (work in any MediaInterface repo) and **backward compatible**: a repo with only root-level `docs/decisions/` behaves exactly as today.
- The four significance criteria and the placement rule must appear **word-identical** where they are duplicated (REFERENCE.md vs. `sdd-policy.md` summary): criteria keywords are *structural impact*, *hard to reverse*, *precedent*, *cross-cutting*; the placement rule sentence is "A record lives on the smallest level whose subtree contains everyone affected."
- When editing SKILL.md files, follow `superpowers:writing-skills` principles (clear triggers in `description`, imperative process steps, no duplication of what the shared reference owns).
- A PreToolUse hook (claude-md-improver) runs on `git commit` and may propose CLAUDE.md updates — that is expected; Task 7 makes the substantive CLAUDE.md edits explicitly.

---

### Task 1: Shared reference `memory-bank-shared/REFERENCE.md`

**Files:**
- Create: `plugins/sdd-kit/skills/memory-bank-shared/REFERENCE.md`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: the sections **Levels**, **Placement rule**, **Delta principle**, **Significance triage**, **Boundaries** — Tasks 2 and 3 link to this file by the relative path `../memory-bank-shared/REFERENCE.md` and reference the section names **Significance triage** and **Placement rule** exactly.

- [ ] **Step 1: Create the file with exactly this content**

````markdown
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
````

- [ ] **Step 2: Verify the file and the section anchors Tasks 2/3 rely on**

Run: `grep -c '^## ' plugins/sdd-kit/skills/memory-bank-shared/REFERENCE.md`
Expected: `5`

Run: `grep -n 'smallest level whose subtree contains everyone affected' plugins/sdd-kit/skills/memory-bank-shared/REFERENCE.md`
Expected: exactly 1 match (the Placement rule blockquote).

- [ ] **Step 3: Commit**

```bash
git add plugins/sdd-kit/skills/memory-bank-shared/REFERENCE.md
git commit -m "✨ feat(sdd-kit): memory-bank shared reference — levels, placement rule, significance triage"
```

---

### Task 2: Rewrite `create-decision/SKILL.md` (gate + scope step)

**Files:**
- Modify: `plugins/sdd-kit/skills/create-decision/SKILL.md` (full rewrite)

**Interfaces:**
- Consumes: `../memory-bank-shared/REFERENCE.md` sections **Significance triage** and **Placement rule** (Task 1).
- Produces: the 7-step flow (root → gate → level → gather → create → index → confirm) that Task 8's dry-run scenarios exercise; the phrase `{scope}/docs/decisions/` used consistently.

- [ ] **Step 1: Replace the entire file with this content**

`````markdown
---
name: create-decision
description: Creates a new Decision Record in the Memory Bank for significant decisions — technology or structure choices, security/quality baselines, precedent-setting patterns, or cross-cutting changes to ways of working. Use during spec creation or whenever such a decision is made. Triggers on phrases like "decision record", "we decided to", "write a decision", "document the decision", "why did we choose X over Y", or "ADR". Not every decision qualifies — the skill triages significance first and routes implementation details to conventions, learnings, or the spec instead.
---

# Create Decision Record

This skill guides through creating a Decision Record in MADR format and
places the file on the correct Memory Bank **level**. Decision Records
cover all types of significant decisions, not just architectural ones.
The category field in the frontmatter indicates what kind of decision it
is.

This skill is part of the Memory Bank. Conventions live as Claude Code
Rules in `.claude/rules/` (auto-loaded). Decisions and learnings live
under `docs/decisions/` and `docs/learnings/` of their level — the repo
root for suite-wide records, or an app/service subtree for records that
concern only that app. Levels, the placement rule, and the significance
triage are defined in the shared reference:
[memory-bank-shared/REFERENCE.md](../memory-bank-shared/REFERENCE.md).

## Process

### Step 1: Determine repo root

Find the repo root directory (where `.git/` is located). All paths in
this skill are relative to the repo root.

### Step 2: Significance gate

Apply the **Significance triage** from the shared reference. Judge the
decision as understood from the conversation context — the skill is
usually invoked right after a decision was made. If it was invoked
without enough context to judge, first ask the user to state the decision
in one line, then apply the gate.

Create a record only if **at least one** of the four criteria applies
(structural impact · hard to reverse · precedent · cross-cutting). If
none applies, **do not create the record**. Tell the user which criteria
failed and route instead, per the triage table in the shared reference:
a recurring coding rule → convention in `.claude/rules/` (explain the
rule-file format so the user can add it manually), an observation or
pitfall → suggest `/create-lesson-learned`, a one-off local design
choice → it stays in the spec / PR description.

The criteria are fixed and changed only by the Hüter-Trio. Do not create
a refused record on insistence — ask the user to raise the case with the
Hüter-Trio instead.

When the gate passes as a **precedent**, document the generalizable
pattern, not the single instance (see **Generalize** in the shared
reference). The second application of an established pattern gets no new
record.

### Step 3: Determine the level

Decide where the record lives using the **Placement rule** from the
shared reference: *a record lives on the smallest level whose subtree
contains everyone affected.*

Derive from the conversation context which apps/services are affected
and **propose** the level: the repo root for cross-cutting, process, or
repo-wide records; `apps/<app>/` or `services/<service>/` for records
affecting a single app; an intermediate directory (e.g. `services/`)
when several siblings below it are affected. The user confirms or
corrects the proposal. If the affected scope is not apparent from
context, **ask — never guess.**

`{scope}` below is the confirmed level directory (empty for the repo
root).

### Step 4: Gather information

Ask the user for the following information. If answers are already apparent
from the conversation context (e.g. because a spec is currently being
written), suggest them instead of asking again.

1. **Title**: Short description of the decision (also used for the filename)
2. **Category**: Offer this selection:
   - Architecture
   - Security
   - API
   - Testing
   - Infrastructure
3. **Context and problem**: What is the situation? What is the problem?
4. **Decision drivers**: Which factors influence the decision?
5. **Considered options**: Which alternatives were evaluated? (at least 2)
6. **Decision**: Which option was chosen and why?
7. **Consequences**: What follows from this, positive and negative?
8. **Deciders**: Who was involved in the decision?

For each considered option, also ask about pros and cons.

### Step 5: Create file

Create the file at `{scope}/docs/decisions/YYYY-MM-DD-kebab-case-title.md`.

The filename is derived from the date and title:
- Today's date as prefix (YYYY-MM-DD)
- Then a hyphen
- Title in lowercase
- Spaces replaced by hyphens
- Special characters removed
- Title portion truncated to max 80 characters to avoid path length issues on Windows

If `{scope}/docs/decisions/` does not exist, create the directory. If the
resulting filename already exists on that level (same title on the same
day), make the title more specific instead of overwriting.

If the record specializes or deviates from a record on a higher level,
link that record in the **Context and problem** section (**Delta
principle** in the shared reference) — do not repeat its content.

Use this template:

```markdown
---
# status: Active | Declined | Deprecated | Superseded by YYYY-MM-DD-kebab-case-title
status: Active
date: {today's date, YYYY-MM-DD}
last-modified: {today's date, YYYY-MM-DD}
# category: Architecture | Security | API | Testing | Infrastructure
category: {selected category}
deciders: {deciders}
---

# {Title}

## Context and problem

{Context and problem}

## Decision drivers

{List of factors}

## Considered options

{Numbered list of options}

## Decision

{Chosen option and justification}

### Consequences

- Positive: {positive consequences}
- Negative: {negative consequences}

## Pros and cons of the options

### {Option 1}

- Good, because {advantage}
- Bad, because {disadvantage}

### {Option 2}

- Good, because {advantage}
- Bad, because {disadvantage}
```

### Step 6: Update index

Update `{scope}/docs/decisions/README.md` with the new entry. If the
file does not exist, create it with a heading. The index lists all decisions
of **this level** with their date, title, status and category:

```markdown
# Decision Records

| Date | Title | Status | Category |
|------|-------|--------|----------|
| 2026-07-15 | [Monorepo for MIRA Suite](2026-07-15-monorepo-for-mira-suite.md) | Active | Architecture |
| 2026-07-16 | [New decision title](2026-07-16-new-decision-title.md) | Active | Security |
```

Add the new entry at the end of the table, which keeps it
chronologically sorted. Never list records of other levels here — every
level maintains only its own index.

### Step 7: Confirmation

Show the user:
- The complete content of the created file
- The file path, naming the level it lives on (e.g. "app level
  `apps/mira-desktop/`" or "suite level, repo root")
- The note: "The decision has status 'Active' and is binding immediately —
  the team is trusted to make it and manages the lifecycle itself, deprecating
  a decision or superseding it with a new one as things evolve. The Hüter-Trio
  is not added as a reviewer; they review new decisions on a scheduled basis
  (everything since their last meeting) and only guard: they flag any
  contradictory or nonsensical decision to be declined or revised and make sure
  decisions are applied everywhere, so the architecture and code do not drift."
- The note: "Check in the decision together with the spec and create a PR."

## Important

- The status is always `Active` on creation, and the team manages the
  lifecycle itself: it deprecates decisions or supersedes them with new ones
  as things evolve. The Hüter-Trio does not run the lifecycle and is not added
  as a PR reviewer; they review on a scheduled basis (all records since their
  last meeting) and only guard — flagging any contradictory or nonsensical
  decision to be declined or revised, and ensuring decisions are applied
  everywhere so the architecture and code do not drift.
- Decisions are never deleted. When a decision is revised, create a new
  decision record that supersedes the old one, and set the old record's
  status to `Superseded by <new record's filename without .md>`.
- Records are never moved between levels by this skill. Migrating legacy
  records (including repos whose records all still sit at the repo root)
  is a project of the affected repo.
- Repos may still contain records with the legacy sequential naming
  (`NNNN-…`). Leave them exactly as they are — old and new names coexist
  in the same directory. Never renumber or rename existing records:
  renaming is what causes stale references.
- When the user asks about available categories: the list is fixed and
  can only be extended by the Hüter-Trio. The same holds for the
  significance criteria.
`````

- [ ] **Step 2: Verify structure and links**

Run: `grep -n '^### Step' plugins/sdd-kit/skills/create-decision/SKILL.md`
Expected: 7 steps, in order: repo root, Significance gate, Determine the level, Gather information, Create file, Update index, Confirmation.

Run: `test -f plugins/sdd-kit/skills/memory-bank-shared/REFERENCE.md && grep -c 'memory-bank-shared/REFERENCE.md' plugins/sdd-kit/skills/create-decision/SKILL.md`
Expected: the file exists and at least 1 link occurrence.

- [ ] **Step 3: Commit**

```bash
git add plugins/sdd-kit/skills/create-decision/SKILL.md
git commit -m "✨ feat(sdd-kit): hard significance gate + level scoping in /create-decision"
```

---

### Task 3: Scope step in `create-lesson-learned/SKILL.md`

**Files:**
- Modify: `plugins/sdd-kit/skills/create-lesson-learned/SKILL.md` (full rewrite)

**Interfaces:**
- Consumes: `../memory-bank-shared/REFERENCE.md` section **Placement rule** (Task 1).
- Produces: the 6-step flow (root → level → gather → create → index → confirm) with `{scope}/docs/learnings/` paths, exercised by Task 8 scenario 3.

- [ ] **Step 1: Replace the entire file with this content**

`````markdown
---
name: create-lesson-learned
description: Creates a new Lesson Learned entry in the Memory Bank. Use this skill when a recurring pattern, pitfall or insight should be captured, e.g. when Claude repeatedly makes the same mistake, when a pattern emerges in reviews, or when something was learned during debugging. Also triggers on phrases like "this keeps happening", "we should document this", "lesson learned", "AI mistake", "I've seen this for the third time now".
---

# Create Lesson Learned

This skill guides through creating a Lesson Learned entry and places
the file on the correct Memory Bank **level** (analogous to decision
records). Each Lesson Learned is stored as its own file.

This skill is part of the Memory Bank. Conventions live as Claude Code
Rules in `.claude/rules/` (auto-loaded). Decisions and learnings live
under `docs/decisions/` and `docs/learnings/` of their level. Levels and
the placement rule are defined in the shared reference:
[memory-bank-shared/REFERENCE.md](../memory-bank-shared/REFERENCE.md).
Learnings have **no significance gate** — they are deliberately
low-threshold.

## Process

### Step 1: Determine repo root

Find the repo root directory (where `.git/` is located). All paths in
this skill are relative to the repo root.

### Step 2: Determine the level

Decide where the entry lives using the **Placement rule** from the
shared reference: *a record lives on the smallest level whose subtree
contains everyone affected.* For a learning that is usually the place
where the pitfall applies — e.g. `services/controller-app/` for an
EF-Core pitfall in that service, the repo root for a tooling pitfall
that concerns everyone.

Propose the level derived from the conversation context; the user
confirms or corrects. If the affected scope is not apparent from
context, **ask — never guess.**

`{scope}` below is the confirmed level directory (empty for the repo
root).

### Step 3: Gather information

Ask the user for the following information. If answers are already apparent
from the conversation context (e.g. because a review problem is currently
being discussed), suggest them instead of asking again.

1. **Title**: Short description of the observation
2. **Category**: Offer this selection:
   - KI-Pattern
   - Review
   - Architecture
   - Testing
3. **Observation**: What is repeatedly occurring? Where was it observed?
4. **Problem**: Why is this a problem?
5. **Solution or workaround**: What helps against it? (can also be "still open")
6. **Observed in**: References to PRs, reviews or stories where this occurred (optional)
7. **Related conventions/decision records**: Are there existing conventions or decision records that relate to this? (optional)

### Step 4: Create file

Create the file at `{scope}/docs/learnings/YYYY-MM-DD-kebab-case-title.md`.

The filename is derived from the date and title:
- Today's date as prefix (YYYY-MM-DD)
- Then a hyphen
- Title in lowercase
- Spaces replaced by hyphens
- Special characters removed
- Title portion truncated to max 80 characters to avoid path length issues on Windows

If `{scope}/docs/learnings/` does not exist, create the directory.

Use this template:

```markdown
---
# status: Active | Resolved
status: Active
date: {today's date, YYYY-MM-DD}
last-modified: {today's date, YYYY-MM-DD}
# category: KI-Pattern | Review | Architecture | Testing
category: {selected category}
observed-in: {PRs/reviews/stories, if provided}
---

# {Title}

## Observation

{What is repeatedly occurring? Where was it observed?}

## Problem

{Why is this a problem?}

## Solution or workaround

{What helps against it?}

## Related conventions/decision records

{References to existing files, if available}
```

### Step 5: Update index

Update `{scope}/docs/learnings/README.md` with the new entry. If the
file does not exist, create it with a heading. The index lists all learnings
of **this level** with their date, title, status and category:

```markdown
# Learnings

| Date | Title | Status | Category |
|------|-------|--------|----------|
| 2026-06-07 | [Claude generates wrong enum serialization](2026-06-07-claude-generates-wrong-enum-serialization.md) | Active | KI-Pattern |
| 2026-06-08 | [E2E tests flaky with WaitForLoadState](2026-06-08-e2e-tests-flaky-with-waitforloadstate.md) | Resolved | Testing |
```

Add the new entry at the end of the table. Never list entries of other
levels here — every level maintains only its own index.

### Step 6: Confirmation

Show the user:
- The complete content of the created entry
- The file path, naming the level it lives on
- The note: "Create a PR with this change. The entry is active immediately —
  the team is trusted to capture it and to resolve it later when it becomes a
  convention or decision record. The Hüter-Trio is not added as a reviewer;
  they review new entries on a scheduled basis (all changes since their last
  meeting) and only guard: they flag any contradictory or nonsensical entry
  and make sure learnings are applied everywhere, so the architecture and code
  do not drift."

If the observation is actually a rule (e.g. "always do it this way"),
suggest writing a convention (Claude Code Rule in `.claude/rules/`) instead.

If the observation is actually a decision, suggest using
`/create-decision` instead (note that it applies a significance gate).

## Lifecycle

- `Active`: Observation is current, workaround documented.
- `Resolved`: The Lesson Learned became a convention or decision record.
  Reference the new file and change the status.

When the user wants to set an existing Lesson Learned to `Resolved`,
help them: change the status, update `last-modified`, and add the
reference to the new convention/decision record.
`````

- [ ] **Step 2: Verify structure and links**

Run: `grep -n '^### Step' plugins/sdd-kit/skills/create-lesson-learned/SKILL.md`
Expected: 6 steps, in order: repo root, Determine the level, Gather information, Create file, Update index, Confirmation.

Run: `grep -c '{scope}/docs/learnings/' plugins/sdd-kit/skills/create-lesson-learned/SKILL.md`
Expected: `3` (create path, missing-dir line, index path).

- [ ] **Step 3: Commit**

```bash
git add plugins/sdd-kit/skills/create-lesson-learned/SKILL.md
git commit -m "✨ feat(sdd-kit): level scoping in /create-lesson-learned"
```

---

### Task 4: Significance & placement summary in `sdd-policy.md`

**Files:**
- Modify: `plugins/sdd-kit/hooks/sdd-policy.md`

**Interfaces:**
- Consumes: criteria keywords and placement-rule sentence from Task 1 (must stay word-identical).
- Produces: a policy section Claude sees in every session where the SDD policy is in force.

- [ ] **Step 1: Insert a new section**

Insert between the section `## Spec → PR before implementation` (ends with the paragraph "**Ticket state.** … do not change the state yourself.") and the section `## Implementation: plan steps → Azure DevOps tasks`:

```markdown
## Memory Bank records: significance & placement

Before proposing or creating a Decision Record, apply the significance
triage: a record is warranted only if the decision has **structural
impact** (structure, interfaces, dependencies, or quality attributes), is
**hard to reverse**, sets a **precedent** future code should follow, or is
**cross-cutting** (spans features, apps, or teams). Otherwise do not
propose one — a recurring coding rule belongs in `.claude/rules/`
(convention), an observed pitfall in `/create-lesson-learned`, and a
one-off local design choice stays in the spec or PR.

Records live on Memory Bank **levels**: place each record in the
`docs/decisions/` (or `docs/learnings/`) of the right level. A record
lives on the smallest level whose subtree contains everyone affected —
the repo root only for cross-cutting matters, `apps/<app>/` or
`services/<service>/` for single-app records. Details: the
`sdd-kit:create-decision` skill and its shared reference.
```

- [ ] **Step 2: Verify consistency with the reference**

Run: `grep -c 'smallest level whose subtree contains everyone affected' plugins/sdd-kit/hooks/sdd-policy.md plugins/sdd-kit/skills/memory-bank-shared/REFERENCE.md`
Expected: 1 match in each file (word-identical rule).

Run: `node plugins/sdd-kit/hooks/inject-sdd-policy.js < /dev/null | grep -c "Memory Bank records: significance & placement"`
Expected: `1` (the hook script consumes stdin without parsing it and emits the policy as JSON `additionalContext` — this proves the payload still loads with the new section).

- [ ] **Step 3: Commit**

```bash
git add plugins/sdd-kit/hooks/sdd-policy.md
git commit -m "✨ feat(sdd-kit): memory-bank significance & placement section in the SDD session policy"
```

---

### Task 5: Guardian scans all levels + misplacement flag

**Files:**
- Modify: `plugins/guardian/skills/memory-bank-changes/SKILL.md`
- Modify: `plugins/guardian/README.md`

**Interfaces:**
- Consumes: nothing from other tasks (guardian is a separate plugin — it repeats the placement rule in one sentence instead of linking across plugins).
- Produces: the multi-level scan Task 8 scenario 4 verifies.

- [ ] **Step 1: Update the "What counts" table**

In `plugins/guardian/skills/memory-bank-changes/SKILL.md`, replace:

```markdown
| Artifact | Location | Index |
|----------|----------|-------|
| Decision Records (ADRs) | `docs/decisions/NNNN-*.md` | `docs/decisions/README.md` |
| Lessons Learned | `docs/learnings/YYYY-MM-DD-*.md` | `docs/learnings/README.md` |
| Conventions (Claude Code Rules) | `.claude/rules/*.md` | — |
```

with:

```markdown
| Artifact | Location | Index |
|----------|----------|-------|
| Decision Records (ADRs) | every `docs/decisions/` directory, root or nested (e.g. `apps/<app>/docs/decisions/`) | one `README.md` per directory |
| Lessons Learned | every `docs/learnings/` directory, root or nested | one `README.md` per directory |
| Conventions (Claude Code Rules) | `.claude/rules/*.md` (root only) | — |

Decisions and learnings live on Memory Bank **levels** — directory
subtrees with their own `docs/decisions/` + `docs/learnings/`. The
placement rule (from sdd-kit): a record lives on the smallest level whose
subtree contains everyone affected. A repo without nested levels simply
has everything at the root.
```

- [ ] **Step 2: Update the Step-3 git command**

Replace:

```bash
git log --since="<WINDOW>" --date=short -M --name-status \
  --pretty=format:'@@ %h | %an | %cd | %s' \
  -- docs/decisions docs/learnings .claude/rules
```

with:

```bash
git log --since="<WINDOW>" --date=short -M --name-status \
  --pretty=format:'@@ %h | %an | %cd | %s' \
  -- '*docs/decisions/*' '*docs/learnings/*' .claude/rules
```

And replace the sentence "Non-existent directories in the pathspec are ignored (no error), so pass all three." with: "The quoted wildcard pathspecs match `docs/decisions/` and `docs/learnings/` directories at **any depth** (root and nested levels alike; a git pathspec `*` also crosses `/`), and non-existent paths are ignored (no error), so pass all three."

- [ ] **Step 3: Update the report header line**

In the *Report format* example, replace:

```
scanned: docs/decisions, docs/learnings, .claude/rules
```

with:

```
scanned: docs/… (root), apps/mira-desktop/docs/…, .claude/rules
```

And in Step 5's prose add one sentence after "Group by artifact type, most recent first within each group.": "Derive the `scanned:` line from the touched paths — list each level that actually appears in the window (`docs/… (root)`, `apps/<app>/docs/…`, …) plus `.claude/rules`; records already show their full path, so no extra per-entry level label is needed."

- [ ] **Step 4: Add the misplacement guardian flag**

In the *Guardian flags* section, append after the "**Overlapping new records**" bullet:

```markdown
- **Suspected misplacement** — a repo-root (suite-level) record whose
  content names only a single app or service, or a nested (app-level)
  record that legislates repo-wide. Placement rule: a record lives on the
  smallest level whose subtree contains everyone affected. Surface it so
  the guardian can check the placement.
```

- [ ] **Step 5: Update `plugins/guardian/README.md`**

Replace:

```markdown
- **What it covers**: Decision Records (`docs/decisions/`), Lessons Learned
  (`docs/learnings/`), and Conventions (Claude Code Rules in `.claude/rules/`).
```

with:

```markdown
- **What it covers**: Decision Records and Lessons Learned in every
  `docs/decisions/` / `docs/learnings/` directory on any Memory Bank level
  (repo root or nested, e.g. `apps/<app>/docs/decisions/`), and Conventions
  (Claude Code Rules in `.claude/rules/`).
```

- [ ] **Step 6: Verify the new pathspec against a two-level fixture repo**

```bash
FIX="$SCRATCHPAD/mb-fixture" && rm -rf "$FIX" && mkdir -p "$FIX" && cd "$FIX" && git init -q
mkdir -p docs/decisions apps/foo/docs/learnings
printf -- '---\nstatus: Active\ncategory: Architecture\n---\n# Suite decision\n' > docs/decisions/2026-07-21-suite-decision.md
printf -- '---\nstatus: Active\ncategory: Testing\n---\n# App learning\n' > apps/foo/docs/learnings/2026-07-21-app-learning.md
git add -A && git commit -qm test
git log --since="7 days ago" --date=short -M --name-status \
  --pretty=format:'@@ %h | %an | %cd | %s' \
  -- '*docs/decisions/*' '*docs/learnings/*' .claude/rules
```

(`$SCRATCHPAD` = the session scratchpad directory; any temp dir outside the repo works.)
Expected output: one `@@` commit line followed by **both** files:
`A	apps/foo/docs/learnings/2026-07-21-app-learning.md` and `A	docs/decisions/2026-07-21-suite-decision.md`.

- [ ] **Step 7: Commit (back in the worktree)**

```bash
git add plugins/guardian/skills/memory-bank-changes/SKILL.md plugins/guardian/README.md
git commit -m "✨ feat(guardian): scan memory-bank levels at any depth + misplacement flag in /memory-bank-changes"
```

---

### Task 6: `ado-pr` spec-only detection covers nested `docs/`

**Files:**
- Modify: `plugins/sdd-kit/skills/ado-pr/SKILL.md` (step 7, around line 76–81)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing downstream — self-contained wording fix.

- [ ] **Step 1: Apply the edit**

Replace:

```markdown
   **Spec PR vs implementation PR.** In the SDD workflow a spec and its implementation are
   **never** in the same PR. This is a **spec PR** when the user invoked `create spec`, or when
   every changed file (from step 4) is documentation/spec/ADR — i.e. `*.md` or anything under
   `docs/` (including `docs/decisions/`) — and no source code changed. When auto-detected,
```

with:

```markdown
   **Spec PR vs implementation PR.** In the SDD workflow a spec and its implementation are
   **never** in the same PR. This is a **spec PR** when the user invoked `create spec`, or when
   every changed file (from step 4) is documentation/spec/ADR — i.e. `*.md` or anything under
   a `docs/` directory on any level (root `docs/`, or nested like `apps/<app>/docs/`,
   `services/<service>/docs/`, including their `decisions/` and `learnings/`) — and no source
   code changed. When auto-detected,
```

- [ ] **Step 2: Verify**

Run: `grep -n 'docs/` directory on any level' plugins/sdd-kit/skills/ado-pr/SKILL.md`
Expected: 1 match; `grep -c 'including `docs/decisions/`' plugins/sdd-kit/skills/ado-pr/SKILL.md` returns `0`.

- [ ] **Step 3: Commit**

```bash
git add plugins/sdd-kit/skills/ado-pr/SKILL.md
git commit -m "🏗️ refactor(sdd-kit): spec-only PR detection covers nested docs/ directories"
```

---

### Task 7: Version bumps + repo docs

**Files:**
- Modify: `plugins/sdd-kit/.claude-plugin/plugin.json` (version `1.3.1` → `1.4.0`)
- Modify: `plugins/guardian/.claude-plugin/plugin.json` (version `1.0.0` → `1.1.0`)
- Modify: `.claude-plugin/marketplace.json` (same two version fields)
- Modify: `CLAUDE.md` (repo root)

**Interfaces:**
- Consumes: everything before (documents the final state).
- Produces: nothing downstream.

- [ ] **Step 1: Bump versions**

In `plugins/sdd-kit/.claude-plugin/plugin.json`: `"version": "1.3.1"` → `"version": "1.4.0"`.
In `plugins/guardian/.claude-plugin/plugin.json`: `"version": "1.0.0"` → `"version": "1.1.0"`.
In `.claude-plugin/marketplace.json`: the `sdd-kit` entry `"version": "1.3.1"` → `"1.4.0"`, the `guardian` entry `"version": "1.0.0"` → `"1.1.0"` (do not touch the other plugins' entries).

- [ ] **Step 2: Update `CLAUDE.md`**

1. In the repository-structure tree, under `sdd-kit`'s `skills/` listing, insert after the `create-lesson-learned` lines:

```
│       ├── memory-bank-shared/
│       │   └── REFERENCE.md  # Shared levels model, placement rule, significance triage (not a skill)
```

2. Replace the `create-decision` bullet in the sdd-kit section:

```markdown
- **Skill** (`plugins/sdd-kit/skills/create-decision/SKILL.md`): `/create-decision` — documents decisions in the Memory Bank as Decision Records, named `docs/decisions/YYYY-MM-DD-<title>.md` (date-based like learnings, so parallel branches don't collide on a "next number"; legacy `NNNN-…` records coexist and are never renamed).
```

with:

```markdown
- **Skill** (`plugins/sdd-kit/skills/create-decision/SKILL.md`): `/create-decision` — documents decisions in the Memory Bank as Decision Records, named `docs/decisions/YYYY-MM-DD-<title>.md` (date-based like learnings, so parallel branches don't collide on a "next number"; legacy `NNNN-…` records coexist and are never renamed). Applies a **hard significance gate** (record only on structural impact, hard-to-reverse, precedent, or cross-cutting — otherwise routes to a convention, a learning, or the spec) and places the record on the right **Memory Bank level** (`docs/decisions/` of the smallest directory subtree containing everyone affected — repo root, `apps/<app>/`, `services/<service>/`, …). Gate, placement rule, and delta principle live in `skills/memory-bank-shared/REFERENCE.md` (a non-skill shared reference, pattern as `ado-shared`).
```

3. Replace the `create-lesson-learned` bullet:

```markdown
- **Skill** (`plugins/sdd-kit/skills/create-lesson-learned/SKILL.md`): `/create-lesson-learned` — captures recurring patterns and pitfalls in the Memory Bank.
```

with:

```markdown
- **Skill** (`plugins/sdd-kit/skills/create-lesson-learned/SKILL.md`): `/create-lesson-learned` — captures recurring patterns and pitfalls in the Memory Bank, placed on the right Memory Bank level like decisions (no significance gate — learnings stay deliberately low-threshold).
```

4. In the **Hook** bullet of the sdd-kit section, extend the sentence describing the policy's two parts: after "…create ADO tasks via `/ado-workitem` for the approved plan's todo items" the policy now **also** carries a compact "Memory Bank records: significance & placement" section (the four gate criteria + the smallest-covering-level placement rule), so Claude filters record *proposals* before any skill is invoked. Append to that bullet:

```markdown
  The policy prose also carries a compact **Memory Bank records: significance & placement** section — the four significance criteria plus the smallest-covering-level placement rule — so record proposals are filtered at session level, before any skill is invoked.
```

5. In the **guardian** section, replace:

```markdown
Covers all three Memory Bank artifacts — Decision Records (`docs/decisions/`), Lessons Learned (`docs/learnings/`), and Conventions (Claude Code Rules in `.claude/rules/`) — the same locations `sdd-kit`'s `/create-decision` and `/create-lesson-learned` write to.
```

with:

```markdown
Covers all three Memory Bank artifacts — Decision Records and Lessons Learned in every `docs/decisions/` / `docs/learnings/` directory on any Memory Bank level (repo root or nested, e.g. `apps/<app>/docs/decisions/`), and Conventions (Claude Code Rules in `.claude/rules/`) — the same locations `sdd-kit`'s `/create-decision` and `/create-lesson-learned` write to; it also flags suspected level misplacements.
```

- [ ] **Step 3: Verify JSON validity**

Run: `node -e "['plugins/sdd-kit/.claude-plugin/plugin.json','plugins/guardian/.claude-plugin/plugin.json','.claude-plugin/marketplace.json'].forEach(f=>JSON.parse(require('fs').readFileSync(f,'utf8'))); console.log('ok')"`
Expected: `ok`

Run: `grep -c '"version": "1.4.0"' .claude-plugin/marketplace.json plugins/sdd-kit/.claude-plugin/plugin.json`
Expected: 1 match in each file (and the same check with `1.1.0` for guardian's two files).

- [ ] **Step 4: Commit**

```bash
git add plugins/sdd-kit/.claude-plugin/plugin.json plugins/guardian/.claude-plugin/plugin.json .claude-plugin/marketplace.json CLAUDE.md
git commit -m "🔖 chore(marketplace): bump sdd-kit to 1.4.0 and guardian to 1.1.0, update repo docs"
```

---

### Task 8: Scenario dry-runs (spec §Verification)

**Files:**
- No file changes (verification only; fixture repo in the scratchpad from Task 5 Step 6 is reused/rebuilt as needed).

**Interfaces:**
- Consumes: the final SKILL.md files from Tasks 2, 3, 5.
- Produces: a pass/fail verdict per scenario; failures loop back as fixes to the owning task's file (amend or follow-up commit).

Each scenario is a **dry-run**: give a fresh subagent the updated SKILL.md text plus the scenario prompt, and check that the behavior it derives matches the expectation. Do not let the subagent write into any real repo — answers only.

- [ ] **Step 1: Gate passes a precedent (0036-like)**

Scenario prompt: "In the Mira monorepo (`apps/mira-desktop`, `apps/mira-windows`, `services/controller-app`, …), the team just decided that the mira-desktop dictation toolbar talks to the editor feature via an editor-owned Zustand command-bridge store — the first cross-feature bridge in the renderer. Following this SKILL.md, would you create a Decision Record, and where?"
Expected: record **created** (criterion: precedent, arguably structural impact), level `apps/mira-desktop/`, path `apps/mira-desktop/docs/decisions/YYYY-MM-DD-….md`, and the subagent notes documenting the generalized pattern.

- [ ] **Step 2: Gate refuses a convention (0038-like)**

Scenario prompt: "The team decided icon-only buttons are always circular with the toolbar hover treatment. Following this SKILL.md, what do you do?"
Expected: record **refused** (no criterion applies; recurring how-we-write-code rule), route = convention in `.claude/rules/`, with the rule-file format explained.

- [ ] **Step 3: Scope resolution — backend-spanning and process cases**

Scenario prompt A: "Quartz scheduling is switched to clustered mode with a persistent ADO.NET job store; it affects `services/controller-app` and `services/vocabulary-unit`. Where does the record go?"
Expected A: level `services/` → `services/docs/decisions/`.
Scenario prompt B: "We suspend the feature-flag requirement for all new features until a client flag system exists (process decision). Where does the record go?"
Expected B: repo root → `docs/decisions/`.

- [ ] **Step 4: Learning scoping**

Scenario prompt: "EF Core implicit transactions don't cover read-then-write guards; observed in ControllerApp's DbContext usage. Following create-lesson-learned's SKILL.md, where does the learning go?"
Expected: `services/controller-app/docs/learnings/` (or `services/` if the subagent argues all EF-Core services are affected — both acceptable; root is a failure).

- [ ] **Step 5: Guardian two-level report + misplacement flag**

Extend the Task 5 fixture: add a root-level decision whose H1 names only one app, e.g. `docs/decisions/2026-07-21-mira-desktop-toolbar-store.md` with `# mira-desktop: toolbar command store`, commit. Give a subagent the updated guardian SKILL.md and the fixture path; have it run steps 1–6 for the last 7 days.
Expected: the report lists records from **both** levels, and the flags section raises **Suspected misplacement** for the root-level record naming a single app.

- [ ] **Step 6: Record the verdicts**

Summarize pass/fail per scenario in the session (no repo file). On any failure: fix the owning SKILL.md, commit the fix (`🐞 fix(sdd-kit|guardian): …`), and re-run only the failed scenario.

---

## Out of scope (per spec)

- Mira migration (record moves, concept-doc update, root-index level list) — follow-up project in the Mira repo (SDD workflow applies there).
- Fate of convention-candidate records 0022/0023/0038 — Hüter-Trio.
- Any `scope:` frontmatter or template change.
- The GitHub release workflow / `--latest` tag contention (pre-existing, unrelated).
