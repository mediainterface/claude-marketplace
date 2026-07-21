---
name: memory-bank-changes
description: Use when a guardian (Hüter-Trio / Hüter) reviews what changed in the Memory Bank and needs to trace who changed what and why since their last review. Triggers on "what changed in the memory bank", "memory bank changes since <date>", "review decisions/learnings/conventions since the last meeting", "guardian review", or auditing recent decision records, lessons learned, or Claude Code rules.
---

# Memory Bank Changes

## Overview

Reports every Memory Bank change since a date so a guardian (the Hüter-Trio)
can trace **what changed, by whom, and why** — then decide whether everything
is fine or something needs a closer look.

The change data comes from **git history** (author, date, commit message, and
which files were added/modified/deleted) enriched with each record's own
**content** (title, category, status, deciders, and a short reasoning summary).
It is **read-only**: it never edits records or writes files — it just prints
the report, unless the user explicitly asks to save it to a path they name.

The skill always operates on **the repo of the current working directory** —
run it once inside each project repo you want to review.

## When to use

- A guardian wants to see recent Memory Bank activity for review.
- "What changed in the memory bank in the last week / since <date>?"

Do **not** use it to create records — that is `create-decision` /
`create-lesson-learned`.

## What counts as the Memory Bank

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

The `README.md` index files are **not records** — exclude them from the record
list (mention an index refresh only in passing, if at all).

## Process

### Step 1 — Find the repo

Run `git rev-parse --show-toplevel` from the current directory. If it fails, the
directory is not a git repository: tell the user the Memory Bank must live in a
git repo and stop. Otherwise run every git command below from that root
(`cd` there or use `git -C <root>`).

### Step 2 — Resolve the window

Default to `7 days ago` when the user gives no date. Otherwise pass their input
straight through as `<WINDOW>` — git accepts absolute dates (`2026-06-01`) and
relative expressions (`"3 weeks ago"`, `"last monday"`). State the resolved
window in the report header.

### Step 3 — Scan git history

```bash
git log --since="<WINDOW>" --date=short -M --name-status \
  --pretty=format:'@@ %h | %an | %cd | %s' \
  -- '*docs/decisions/*' '*docs/learnings/*' .claude/rules
```

The quoted wildcard pathspecs match `docs/decisions/` and `docs/learnings/`
directories at **any depth** (root and nested levels alike; a git pathspec `*`
also crosses `/`), and non-existent paths are ignored (no error), so pass all
three. Each `@@` line is one commit: `hash | author | commit-date | subject`.
The date is the **commit** date (`%cd`), which is what `--since` filters on — do
not use the author date (`%ad`): on a squash merge it is carried over from the
branch and can predate the window, which would print a date older than the
"changes since" date. For normally-committed records the two are identical. The
lines under it are file changes:

| Marker | Meaning |
|--------|---------|
| `A` | Added |
| `M` | Modified |
| `D` | Deleted |
| `Rnnn old new` | Renamed |

Drop `README.md` index files from the record list.

### Step 4 — Enrich each touched record

- **Added / Modified / Renamed** (file still present): read the current file for
  its H1 title and frontmatter `category`, `status`, and `deciders` (decisions)
  or `observed-in` (learnings). Summarise the reasoning in 1–2 sentences from
  the Context/Decision sections (decisions) or Observation/Problem (learnings).
  For a convention, use its H1 or filename.
- **Modified** records: detect a status transition from the diff —
  ```bash
  git log --since="<WINDOW>" --follow -p -- <path> | grep -E '^[+-]status:'
  ```
  and report it as e.g. `Active → Resolved`. `--follow` tracks the file across
  an in-window rename, so a transition in a commit under the old name is not
  missed (Step 3's `-M` already reports such renames).
- **Deleted** records: the file is gone, so recover its title/context from the
  last committed version — `git show <commit>^:<path>`.

### Step 5 — Present the report

Group by artifact type, most recent first within each group. Derive the
`scanned:` line from the touched paths — list each level that actually appears
in the window (`docs/… (root)`, `apps/<app>/docs/…`, …) plus `.claude/rules`;
records already show their full path, so no extra per-entry level label is
needed. Keep it scannable (see format below).

Give each **record** a single entry, even if several commits in the window
touched it. Pick the primary marker by significance — `✖` Deleted > `➜` Renamed
> `✎` Modified > `✚` Added — and note the other events inline (e.g. a record
`✚` Added then `➜` Renamed shows as one Renamed entry mentioning the Add). For a
renamed record, show its current title and path. Header counts: `commits` is the
number of commits from Step 3; `records` is the number of **distinct** records
touched.

### Step 6 — Raise guardian flags

List anything worth a closer look (see the flags section). If nothing is
unusual, say `Flags: none`.

### Step 7 — Do not save by default

A review is an ephemeral, point-in-time artifact, so do not write it into the
repo. Print the report and stop. Only if the user explicitly asks to keep it,
save it to a path they name — do not invent a default location under `docs/`
and do not commit review files on your own initiative.

## Report format

```
Memory Bank changes since <window> — <N> commits, <M> records
scanned: docs/… (root), apps/mira-desktop/docs/…, .claude/rules

## Decision Records
  ✚ Added   0007 "Adopt pydantic v2 for config"   [Architecture · Active]
            by Jonas Weber · 2026-07-01 · deciders: Jonas, Anna
            why: "adopt pydantic v2 for config validation" — replaces ad-hoc
                 dataclass validation that was error-prone
            docs/decisions/0007-adopt-pydantic-v2-for-config.md

## Lessons Learned
  ✎ Modified 2026-05-11 "E2E flaky with WaitForLoadState"  [Testing · Active → Resolved]
            by Anna Roth · 2026-07-02
            why: "resolve e2e flakiness learning"
            docs/learnings/2026-05-11-e2e-flaky-with-waitforloadstate.md

## Conventions (.claude/rules/)
  ✚ Added   commit-message-style.md   by Jonas Weber · 2026-07-04

⚑ Flags: 1
  ✖ Deleted decision 0002 "REST over GraphQL" by Markus Klein — decisions are
    never deleted, only superseded. Confirm this was intended.
```

Use markers `✚` added, `✎` modified, `➜` renamed, `✖` deleted.

## Guardian flags

Surface these so the guardian can decide if a closer look is needed:

- **Deleted decision** — decisions are never deleted, only superseded by a new
  record. A deletion is always a flag.
- **Missing frontmatter** — a record with no `status` or `category`.
- **Status change** — e.g. `Active → Deprecated`, `→ Declined`, `→ Resolved`.
  Surface it so the guardian can confirm the transition is warranted.
- **Overlapping new records** — two or more new records in the window covering
  the same area, which may contradict each other.
- **Suspected misplacement** — a repo-root (suite-level) record whose
  content names only a single app or service, or a nested (app-level)
  record that legislates repo-wide. Placement rule: a record lives on the
  smallest level whose subtree contains everyone affected. Surface it so
  the guardian can check the placement.

## Notes

- **By whom**: the git author is whoever committed the change; PRs may be
  committed by someone other than the decider, so also surface each record's
  `deciders` / `observed-in` field.
- Pure git + file reads — works offline, no external services.
- If there are no changes in the window, say so plainly and stop.
