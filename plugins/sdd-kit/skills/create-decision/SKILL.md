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
(structural impact · hard to reverse · precedent · cross-cutting — the
definitions and the routing table live in the shared reference, which is
authoritative). If none applies, **do not create the record**: tell the
user which criteria failed and route per the **Significance triage**
table in the shared reference.

**Say the evidence out loud.** For every criterion you affirm, name the
criterion *and* its evidence to the user in one line before going on — the
pattern that changes, the second place that exists **today**, the concrete
features/apps/teams, what a revert costs (see **Evidence required** in the
shared reference). An unnamed criterion does not count, and a piece of
evidence that has to be spoken usually falls apart while you speak it.

Then run the **Locality counter-check** even when a criterion held: behavior
at one spot, confined to one feature, cheap to revert → **no record**. Say
so, suggest a comment at the code, and stop.

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
and **propose** the level: the repo root for records spanning multiple
apps/services, process, or repo-wide records; `apps/<app>/` or
`services/<service>/` for records affecting a single app (even ones
spanning several of its features); an intermediate directory (e.g. `services/`)
when several siblings below it are affected. The user confirms or
corrects the proposal. If the affected scope is not apparent from
context, **ask — never guess.**

Before settling on the level, check the proposed level, the levels above
it, and sibling apps/services for an existing record on the topic (see
**Before creating: check the other levels** in the shared reference) — a
higher-level hit is specialized via the delta principle; a sibling-level
hit is a promotion candidate, not a duplicate.

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
  is a project of the affected repo. Promotion to a higher level happens
  by superseding — a new record on the higher level, the old one set to
  `Superseded by …` (see **Promotion** in the shared reference) — never
  by moving files.
- Repos may still contain records with the legacy sequential naming
  (`NNNN-…`). Leave them exactly as they are — old and new names coexist
  in the same directory. Never renumber or rename existing records:
  renaming is what causes stale references.
- When the user asks about available categories: the list is fixed and
  can only be extended by the Hüter-Trio. The same holds for the
  significance criteria.
