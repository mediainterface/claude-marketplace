---
paths:
  - "plugins/sdd-kit/**"
---

# sdd-kit — what no single file states

- **Restated rules move together.** Change a rule at its source, then every restatement:

  | Rule | Source | Restated in |
  |---|---|---|
  | Significance gate (criteria, exclusions, evidence, escalation to the Hüter-Trio) | `skills/memory-bank-shared/REFERENCE.md` | `hooks/sdd-policy.md`, section *Memory Bank records* (a summary) |
  | Where a convention lives (three questions, form) and the routing table | `skills/memory-bank-shared/REFERENCE.md` (*Conventions*) | `hooks/sdd-policy.md` (*Memory Bank records*, a summary), `/spec-pr` Step 3 (table row), guardian `/memory-bank-changes` (what it scans) |
  | Specs and plans are transient: capture duty, deletion at the implementation's review | `hooks/sdd-policy.md` | `/spec-pr` Step 3, `/pr-review` dimension 5, `memory-bank-shared/REFERENCE.md` |
  | Spec PR vs. implementation PR, spec PR conventions | `skills/sdd-pr-shared/REFERENCE.md` | `/pr-review` Phase A.5 (applied in detail), `hooks/sdd-policy.md` (short note) |
  | Design artifact: linked in the spec, the UI is built on it, the spec wins on details | `/design-spec` (*Frontmatter*) | `hooks/sdd-policy.md` (*Implementation*, carried into the plan) |
  | Screenshot round: once, when the UI is final; supported stacks; the hand-off for the rest | `/pr-screenshots` (*When*, Step 1) | `hooks/sdd-policy.md` (*Implementation*) |
  | The split into pull requests is decided in the implementation plan, not in the spec | `hooks/sdd-policy.md` (*Implementation*) | `/design-spec` (*Sections*) |

  The gate itself is the Hüter-Trio's call.
- **The legacy `docs/superpowers/` fallback** sits in `hooks/sdd-policy.md`, `/spec-pr`,
  `/pr-review` and `/design-spec`. Remove it from all four together once no story begun before
  the move to `docs/sdd/` is left.
- **`hooks/sdd-policy.md` is injected into every session.** Keep maintenance notes like the ones
  above out of it.
- **`/pr-screenshots` uploads PR attachments, not work item attachments** (`_apis/wit/attachments`),
  although those could be uploaded before the PR exists: whether Azure DevOps keeps an attachment
  no work item links to is not documented, and images vanishing from merged PRs would go
  unnoticed.
- **SDD concepts stay out of `ado-toolkit`.** Spec PRs, the 📝 marker and the Memory Bank live
  here; `/spec-pr` prescribes them to `ado-toolkit:ado-pr`.
