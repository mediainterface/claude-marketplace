# guardian

Tools for the **guardians** (the Hüter-Trio) to do their job.

The guardians watch over the whole repository and its architecture — not just
the Memory Bank. They review changes on a scheduled basis (everything since
their last meeting), flag anything contradictory or nonsensical, and make sure
decisions are applied everywhere, so the architecture and code do not drift.
This plugin collects the tools they need for that work, starting with the
Memory Bank and growing from there.

## Skills

### `/memory-bank-changes [since]`

Reports every Memory Bank change since a date so a guardian can trace **what
changed, by whom, and why**, then decide whether everything is fine or something
needs a closer look.

- **What it covers**: Decision Records (`docs/decisions/`), Lessons Learned
  (`docs/learnings/`), and Conventions (Claude Code Rules in `.claude/rules/`).
- **How it works**: reconstructs the change timeline from **git history**
  (author, date, commit message, added/modified/deleted/renamed files) and
  enriches each touched record with its own **content** (title, category,
  status, deciders, a short reasoning summary, and status transitions such as
  `Active → Resolved`).
- **Window**: defaults to the last **7 days**; pass any date or expression git
  understands, e.g. `/memory-bank-changes 2026-06-01` or
  `/memory-bank-changes "3 weeks ago"`.
- **Output**: a scannable terminal report grouped by artifact type, with a
  guardian-flags callout (e.g. a *deleted* decision — decisions are never
  deleted, only superseded). Offers to save the report to
  `docs/guardian-review-YYYY-MM-DD.md`.
- **Scope**: read-only, works offline (pure `git` + file reads), and always
  runs against the repo of the **current working directory** — run it once
  inside each project repo you want to review.

## Requirements

- The Memory Bank must live in a **git repository** (it always does — the
  `create-decision` / `create-lesson-learned` skills root records at the repo
  top level).
- No env vars, external services, or extra CLIs.

## Relationship to sdd-kit

The [`sdd-kit`](../sdd-kit) plugin's `/create-decision` and
`/create-lesson-learned` skills *write* the Memory Bank. `guardian` *reviews*
it. The record locations and conventions this skill reads are the ones those
skills produce.
