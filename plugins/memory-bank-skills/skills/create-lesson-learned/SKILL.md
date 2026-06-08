---
name: create-lesson-learned
description: Creates a new Lesson Learned entry in the Memory Bank. Use this skill when a recurring pattern, pitfall or insight should be captured, e.g. when Claude repeatedly makes the same mistake, when a pattern emerges in reviews, or when something was learned during debugging. Also triggers on phrases like "this keeps happening", "we should document this", "lesson learned", "AI mistake", "I've seen this for the third time now".
---

# Create Lesson Learned

This skill guides through creating a Lesson Learned entry and places
the file in the correct location. Each Lesson Learned is stored as its
own file (analogous to ADRs).

This skill is part of the Memory Bank. The Memory Bank is made known to
Claude via a rule in `.claude/rules/memory-bank.md` and contains
conventions, ADRs and lessons learned under `docs/`.

## Process

### Step 1: Determine repo root

Find the repo root directory (where `.git/` is located). All paths in
this skill are relative to the repo root.

### Step 2: Gather information

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
7. **Related conventions/ADRs**: Are there existing conventions or ADRs that relate to this? (optional)

### Step 3: Create file

Create the file at `{repo-root}/docs/lessons-learned/YYYY-MM-DD-kebab-case-title.md`.

The filename is derived from the date and title:
- Today's date as prefix (YYYY-MM-DD)
- Then a hyphen
- Title in lowercase
- Spaces replaced by hyphens
- Special characters removed

If `docs/lessons-learned/` does not exist, create the directory.

Use this template:

```markdown
---
status: Active
date: {today's date, YYYY-MM-DD}
last-modified: {today's date, YYYY-MM-DD}
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

## Related conventions/ADRs

{References to existing files, if available}
```

### Step 4: Confirmation

Show the user:
- The complete content of the created entry
- The file path
- The note: "Create a PR with this change. The Hüter-Trio will be
  automatically added as reviewer."

If the observation is actually a rule (e.g. "always do it this way"),
suggest writing a convention instead.

If the observation is actually an architecture decision, suggest using
`/create-adr` instead.

## Lifecycle

- `Active`: Observation is current, workaround documented.
- `Resolved`: The Lesson Learned became a convention or ADR.
  Reference the new file and change the status.

When the user wants to set an existing Lesson Learned to `Resolved`,
help them: change the status, update `last-modified`, and add the
reference to the new convention/ADR.
