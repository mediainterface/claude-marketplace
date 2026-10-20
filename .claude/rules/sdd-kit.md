---
paths:
  - "plugins/sdd-kit/**"
---

# sdd-kit — what no single file states

- **Restated rules move together.** Change a rule at its source, then every restatement:

  | Rule | Source | Restated in |
  |---|---|---|
  | Significance gate (criteria, exclusions, evidence, escalation to the Hüter-Trio) | `skills/memory-bank-shared/REFERENCE.md` | `hooks/sdd-policy.md`, section *Memory Bank records* (a summary) |
  | Specs and plans are transient: capture duty, deletion at the implementation's review | `hooks/sdd-policy.md` | `/spec-pr` Step 3, `/pr-review` dimension 5, `memory-bank-shared/REFERENCE.md` |
  | Spec PR vs. implementation PR, spec PR conventions | `skills/sdd-pr-shared/REFERENCE.md` | `/pr-review` Phase A.5 (applied in detail), `hooks/sdd-policy.md` (short note) |

  The gate itself is the Hüter-Trio's call.
- **The legacy `docs/superpowers/` fallback** sits in `hooks/sdd-policy.md`, `/spec-pr`,
  `/pr-review` and `/design-spec`. Remove it from all four together once no story begun before
  the move to `docs/sdd/` is left.
- **`hooks/sdd-policy.md` is injected into every session.** Keep maintenance notes like the ones
  above out of it.
- **SDD concepts stay out of `ado-toolkit`.** Spec PRs, the 📝 marker and the Memory Bank live
  here; `/spec-pr` prescribes them to `ado-toolkit:ado-pr`.
