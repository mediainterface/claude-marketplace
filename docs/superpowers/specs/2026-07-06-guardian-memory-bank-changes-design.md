# Design: `guardian` plugin — `memory-bank-changes` skill

- **Date**: 2026-07-06
- **Status**: Approved
- **Author**: MIRA Hüter-Trio (via Claude Code)

## Problem

The guardians (the Hüter-Trio) review the Memory Bank on a scheduled basis —
everything that changed since their last meeting — to flag contradictory or
nonsensical records and to keep decisions applied everywhere so the architecture
and code do not drift. Today there is no tool that surfaces *what changed, by
whom, and why* over a time window. They have to read git history and record
files by hand.

## Goal

A new `guardian` plugin whose first skill, `/memory-bank-changes [since]`,
produces a readable report of every Memory Bank change since a date (default the
last 7 days) so a guardian can trace and review recent activity and decide
whether anything needs a closer look.

## Scope

**In scope**

- All three Memory Bank artifacts:
  - Decision Records — `docs/decisions/NNNN-*.md`
  - Lessons Learned — `docs/learnings/YYYY-MM-DD-*.md`
  - Conventions (Claude Code Rules) — `.claude/rules/*.md`
- Reconstructing *who / when / why* from **git history** and *what / category /
  status / reasoning* from **record content** (a hybrid source).
- A terminal report grouped by artifact type, with a guardian-flags callout and
  an optional saved copy.

**Out of scope (YAGNI for v1)**

- Multi-repo aggregation. The skill runs against the repo of the current working
  directory, one repo at a time — matching how `create-decision` /
  `create-lesson-learned` root records at the repo top level.
- Author/type filter arguments. The report always covers all three artifacts for
  the window.
- Any external service. Pure `git` + file reads; works offline.

## Design

The skill is documentation (`SKILL.md`) that instructs the agent through:

1. **Find the repo** — `git rev-parse --show-toplevel` from the cwd; error and
   stop if not a git repo. All git commands run from that root.
2. **Resolve the window** — default `7 days ago`; otherwise pass the user's input
   straight to `git log --since` (accepts `2026-06-01`, `"3 weeks ago"`, etc.).
3. **Scan git history** — one pass:
   ```bash
   git log --since="<WINDOW>" --date=short -M --name-status \
     --pretty=format:'@@ %h | %an | %ad | %s' \
     -- docs/decisions docs/learnings .claude/rules
   ```
   Non-existent dirs are ignored. Each `@@` line is a commit
   (hash / author / date / subject); the lines under it are file changes
   (`A`/`M`/`D`/`Rnnn old new`). `README.md` index files are dropped from the
   record list.
4. **Enrich each touched record** — read current content for title, `category`,
   `status`, `deciders`/`observed-in`, and a 1–2 sentence reasoning summary. For
   modified records detect status transitions via
   `git log --since=<WINDOW> -p -- <path> | grep -E '^[+-]status:'`. For deleted
   records recover context with `git show <commit>^:<path>`.
5. **Present** — grouped report, most-recent-first per group.
6. **Guardian flags** — deleted decision (decisions are only superseded, never
   deleted), missing frontmatter, status change, overlapping new records.
7. **Offer to save** — write to `docs/guardian-review-YYYY-MM-DD.md` only on
   confirmation.

### Why git-history + content (hybrid)

Git answers *by whom* (author), *when* (commit date), and *why* at the
commit-message level, and it is the only source that also captures deletions and
renames. Record content answers *what* precisely (title, category, status) and
carries the detailed *why* (the decision/observation body). The record's
`deciders` / `observed-in` fields complement the git author, since a PR may be
committed by someone other than the decider.

## Deliverables

- `plugins/guardian/.claude-plugin/plugin.json`
- `plugins/guardian/README.md`
- `plugins/guardian/skills/memory-bank-changes/SKILL.md`
- Registration in `.claude-plugin/marketplace.json`
- Documentation in the root `CLAUDE.md`

## Verification

The exact git commands were validated against a throwaway fixture repo with
multi-author history (added decision, resolved learning with an `Active →
Resolved` status flip, added convention, deleted decision, renamed decision) and
a commit outside the 7-day window. The `SKILL.md` is then exercised by a fresh
subagent against the same fixture to confirm the instructions are followable and
the report is correct.
