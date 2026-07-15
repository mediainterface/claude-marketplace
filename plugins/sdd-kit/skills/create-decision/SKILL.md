---
name: create-decision
description: Creates a new Decision Record in the Memory Bank. Use this skill when any decision needs to be documented, e.g. during spec creation, when switching technologies, when deciding on a new pattern, or when changing ways of working. Also triggers on phrases like "decision record", "we decided to", "write a decision", "document the decision", "why did we choose X over Y", or "ADR".
---

# Create Decision Record

This skill guides through creating a Decision Record in MADR format
and places the file in the correct location. Decision Records cover
all types of decisions, not just architectural ones. The category field
in the frontmatter indicates what kind of decision it is.

This skill is part of the Memory Bank. Conventions live as Claude Code
Rules in `.claude/rules/` (auto-loaded). Decisions and learnings live
under `docs/` and are referenced from the root `CLAUDE.md`.

## Process

### Step 1: Determine repo root

Find the repo root directory (where `.git/` is located). All paths in
this skill are relative to the repo root.

### Step 2: Gather information

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

### Step 3: Create file

Create the file at `{repo-root}/docs/decisions/YYYY-MM-DD-kebab-case-title.md`.

The filename is derived from the date and title:
- Today's date as prefix (YYYY-MM-DD)
- Then a hyphen
- Title in lowercase
- Spaces replaced by hyphens
- Special characters removed
- Title portion truncated to max 80 characters to avoid path length issues on Windows

If `docs/decisions/` does not exist, create the directory. If the
resulting filename already exists (same title on the same day), make
the title more specific instead of overwriting.

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

### Step 4: Update index

Update `{repo-root}/docs/decisions/README.md` with the new entry. If the
file does not exist, create it with a heading. The index lists all decisions
with their date, title, status and category:

```markdown
# Decision Records

| Date | Title | Status | Category |
|------|-------|--------|----------|
| 2026-07-15 | [Monorepo for MIRA Suite](2026-07-15-monorepo-for-mira-suite.md) | Active | Architecture |
| 2026-07-16 | [New decision title](2026-07-16-new-decision-title.md) | Active | Security |
```

Add the new entry at the end of the table, which keeps it
chronologically sorted.

### Step 5: Confirmation

Show the user:
- The complete content of the created file
- The file path
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
- Repos may still contain records with the legacy sequential naming
  (`NNNN-…`). Leave them exactly as they are — old and new names coexist
  in the same directory. Never renumber or rename existing records:
  renaming is what causes stale references.
- When the user asks about available categories: the list is fixed and
  can only be extended by the Hüter-Trio.
