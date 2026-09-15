---
name: create-decision
description: Creates a new Decision Record in the Memory Bank for significant decisions — hard-to-reverse choices of stack, library, data format or build mechanism, rules that spare the team the next decision, product decisions to be protected from silent rollback, breaks with an existing pattern, and cross-cutting changes. Use during spec creation or whenever such a decision is made. Triggers on phrases like "decision record", "we decided to", "write a decision", "document the decision", "why did we choose X over Y", or "ADR". Not every decision qualifies — the skill applies the significance gate with its exclusions first and routes implementation details to conventions, learnings, a CLAUDE.md, or an inline reason in the code instead, and it checks the finished record against the form rules.
---

# Create Decision Record

This skill guides through creating a Decision Record in the Memory Bank's
record format (MADR, reduced to four body sections) and places the file on
the correct Memory Bank **level**. Decision Records
cover all types of significant decisions, not just architectural ones.
The category field in the frontmatter indicates what kind of decision it
is.

This skill is part of the Memory Bank. Conventions live as Claude Code
Rules in `.claude/rules/` (auto-loaded). Decisions and learnings live
under `docs/decisions/` and `docs/learnings/` of their level — the repo
root for suite-wide records, or an app/service subtree for records that
concern only that app. Levels, the placement rule, the significance triage
and the form rules are defined in the shared reference:
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

Create a record only if **at least one** of the five criteria applies
**and no exclusion** does (hard to reverse · eases future decisions ·
product decision to be protected · breaks an existing pattern ·
cross-cutting — the definitions, the exclusions and the routing table live
in the shared reference, which is the single source of truth for the gate).
If no criterion applies, **do not create the record**: tell
the user which criteria failed and route per the **Significance triage**
table in the shared reference.

**Say the evidence out loud.** For every criterion you affirm, name the
criterion *and* its evidence to the user in one line before going on (see
**Evidence required** in the shared reference):

- **Hard to reverse** — what a revert costs, and whether it is the stack, a
  load-bearing library, a stored data format, or the build/distribution
  mechanism.
- **Eases future decisions** — the next case the rule decides without
  re-deciding.
- **Product decision** — what the user notices, and who would roll it back
  unknowingly.
- **Breaks a pattern** — which existing pattern it breaks.
- **Cross-cutting** — the concrete features/apps/teams, and how a different
  implementation would behave differently for the user.

An unnamed criterion does not count, and a piece of evidence that has to be
spoken usually falls apart while you speak it.

Then check the three **exclusions** even when a criterion held — one feature
without effect on others; nothing changed about appearance, stability,
behavior or dev experience; a detail touching the whole app that is neither a
product decision nor hard to revise. Any of them → **no record**. Say which
one bit, suggest an inline reason in the code, and stop.

**When the gate stays unclear, this skill stops here** (see **When the gate
is genuinely unclear** in the shared reference). This is not the escape hatch
for a weak case — a criterion without nameable evidence is simply not met, and
that is a "no record", routed per the table. It is for the case that stays
undecidable *after* the evidence was named: the evidence holds but an
exclusion seems to fit too, or the criterion rests on something nobody has
committed to yet.

Then create **nothing** and do **not** continue to Step 3. You cannot reach
the Hüter-Trio yourself, so hand the case over and pause:

- State the decision, the criterion, and the evidence for **and** against, so
  the user can forward it unchanged.
- Ask the user to put that question to the Hüter-Trio.
- Tell them the skill is paused until the answer is in, and that they invoke
  `/create-decision` again afterwards — with the answer, the gate is a
  one-liner.
- Suggest the inline reason in the code as the interim home of the reasoning.

Do not offer to write the record "provisionally" and revert it later: it is
binding the moment it exists and can only be undone by a second record
superseding it.

The criteria and exclusions are changed only by the Hüter-Trio, in the shared
reference. Do not create a record the gate refused on insistence —
**declining** a record is a team decision, so ask the user to take the case to
the team.

When the gate passes because the decision **eases future decisions** or is
**cross-cutting**, document the generalizable pattern, not the single
instance (see **Generalize** in the shared reference). The second
application of an established pattern gets no new record.

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
   (one paragraph)
4. **Considered options**: Which alternatives were evaluated? (at least 2)
5. **Decision**: Which option was chosen, why, and why the alternatives were
   rejected
6. **Consequences**: What follows from this, positive and negative?
7. **Deciders**: Who was involved in the decision?

Do **not** ask for decision drivers or for a pros-and-cons list per option.
Both only repeat the context and the decision; the rejection of each
alternative is a bullet inside **Decision** instead.

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

Hard-wrap the record's prose at **100 characters** at word boundaries
(**Line length** in the shared reference) — the record is reviewed in a
side-by-side diff.

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

{Context and problem, one paragraph}

## Considered options

{Numbered list of options}

## Decision

{Chosen option}

- {Reason the option was chosen}
- {Rejected alternative and why it was rejected}

## Consequences

- Positive: {positive consequences}
- Negative: {negative consequences}
```

### Step 6: Check the form rules

Check the finished file against the **Form rules for a record** in the shared
reference and report the result to the user — each rule with pass or fail:

1. **Under 80 lines** — count the lines of the file. Over the limit means the
   record carries content that belongs elsewhere; shorten it by removing that
   content (usually spec content or justification prose), not by unwrapping
   the prose.
2. **No amendments** — no "Update", "Nachtrag", "Amendment" or dated
   addition appended below the sections. A changed decision is superseded by
   a new record.
3. **No spec content** — no measurements, thresholds, rule catalogs, or
   mechanics.
4. **No links to work items, PRs, specs, or plans** — including bare `#123`
   work item references. A link to another *record* is fine (that is the
   delta principle).
5. **No justification prose** — no paragraph defending the decision against
   an imagined objection.
6. **Stands on its own** — cross-references only where two decisions really
   interlock.

Fix every violation before going on. Name each violation and the fix to the
user; do not silently rewrite.

### Step 7: Update index

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

### Step 8: Confirmation

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
- A revised decision is **superseded**, never amended and never deleted by
  this skill: create a new decision record and set the old record's status to
  `Superseded by <new record's filename without .md>`. Deleting or merging
  existing records is possible, but as a **team decision** — not a skill
  action, and not on a single user's request.
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
- When the user asks about available categories: the list is fixed and can
  only be extended by the Hüter-Trio, in the shared reference. The same holds
  for the five significance criteria and the three exclusions.
