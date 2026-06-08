---
name: create-decision
description: Creates a new Decision Record in the Memory Bank. Use this skill when any decision needs to be documented, e.g. during spec creation, when switching technologies, when deciding on a new pattern, or when changing ways of working. Also triggers on phrases like "decision record", "we decided to", "write a decision", "document the decision", "why did we choose X over Y", or "ADR".
---

# Create Decision Record

This skill guides through creating a Decision Record in MADR format
and places the file in the correct location. Decision Records cover
all types of decisions, not just architectural ones. The category field
in the frontmatter indicates what kind of decision it is.

This skill is part of the Memory Bank. The Memory Bank is made known to
Claude via a rule in `.claude/rules/memory-bank.md` and contains
conventions, decisions and lessons learned under `docs/`.

## Process

### Step 1: Determine repo root

Find the repo root directory (where `.git/` is located). All paths in
this skill are relative to the repo root.

### Step 2: Determine next decision number

Read all files in `{repo-root}/docs/decisions/` and find the highest
existing number. The new number is that number + 1, formatted as a
four-digit number with leading zeros (e.g. `0001`, `0002`, `0013`).

If `docs/decisions/` does not exist, create the directory and start
with `0001`.

### Step 3: Gather information

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

### Step 4: Create file

Create the file at `{repo-root}/docs/decisions/NNNN-kebab-case-title.md`.

The filename is derived from the number and title:
- Number as four digits with leading zeros
- Then a hyphen
- Title in lowercase
- Spaces replaced by hyphens
- Special characters removed

Use this template:

```markdown
---
# status: Proposed | Accepted | Declined | Deprecated | Superseded by NNNN
status: Proposed
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

### Step 5: Confirmation

Show the user:
- The complete content of the created file
- The file path
- The note: "The decision has status 'Proposed'. It becomes binding once
  the Hüter-Trio sets it to 'Accepted' in the PR review."
- The note: "Check in the decision together with the spec and create a PR."

## Important

- The status is always `Proposed` on creation. Only the Hüter-Trio sets
  the status to `Accepted` or `Declined`.
- Decisions are never deleted. When a decision is revised, create a new
  decision record that supersedes the old one.
- When the user asks about available categories: the list is fixed and
  can only be extended by the Hüter-Trio.
