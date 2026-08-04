---
name: create-lesson-learned
description: Creates a new Lesson Learned entry in the Memory Bank, placed on the right Memory Bank level (repo root, or an app/service subtree like apps/<app>/docs/learnings/). Use this skill when a recurring pattern, pitfall or insight should be captured, e.g. when Claude repeatedly makes the same mistake, when a pattern emerges in reviews, or when something was learned during debugging. Also triggers on phrases like "this keeps happening", "we should document this", "lesson learned", "AI mistake", "I've seen this for the third time now".
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

Hard-wrap the entry's prose at **100 characters** at word boundaries
(**Line length** in the shared reference) — the entry is reviewed in a
side-by-side diff.

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
