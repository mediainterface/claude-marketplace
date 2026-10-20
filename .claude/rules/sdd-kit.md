---
paths:
  - "plugins/sdd-kit/**"
---

# sdd-kit

The skills and the SessionStart policy of MediaInterface's Spec-Driven Development (SDD)
workflow. Not a general-purpose collection: everything here serves that workflow. Azure DevOps
comes from `ado-toolkit` (declared dependency), always called as `ado-toolkit:<skill>`.

## Where each rule lives — change it there, and only there

| Rule | Single source | Restated (keep in sync) |
|---|---|---|
| Significance gate: 5 criteria, 3 exclusions, evidence named, unclear → Hüter-Trio | `skills/memory-bank-shared/REFERENCE.md` | Summary in `hooks/sdd-policy.md` (*Memory Bank records*) |
| Level placement, record naming `docs/decisions/YYYY-MM-DD-<title>.md` | `skills/memory-bank-shared/REFERENCE.md` | — |
| Spec PR vs. implementation PR, spec PR conventions (📝, *Erwartetes Umsetzungsrisiko*) | `skills/sdd-pr-shared/REFERENCE.md` | Short note in the policy |
| Spec/plan transience: capture duty, deletion at code review | `hooks/sdd-policy.md` | `/spec-pr` Step 3, `/pr-review` dimension 5, memory-bank reference |
| Markdown files wrapped at 100 characters | `hooks/sdd-policy.md` | Root `CLAUDE.md` |

The gate itself is the Hüter-Trio's call. The Memory Bank process document in the product repos
points at `/create-decision` instead of repeating the criteria, so they exist only here.

## Invariants

- **Specs and plans are transient.** They are deleted at the **human** code review of the
  story's **implementation** PR, at the latest after the first review round — complete once
  every `isRequired` reviewer has seen the code (current vote, an earlier vote in the system
  threads, or a thread of their own; ADO clears votes on push). Never at a spec PR, never at a
  self-started `/code-review` or `/pr-review`. Durable content is captured *before* the spec
  PR, in one of four homes: inline code reason, user story, `.claude/rules/` convention, Memory
  Bank record.
- **Location `docs/sdd/specs/` and `docs/sdd/plans/`** at the repo root (a story can span
  apps). Superpowers (`brainstorming`, `writing-plans`) stays untouched; the policy states the
  location as a user preference. Legacy `docs/superpowers/` is still searched by `/spec-pr`
  Step 1, the policy's deletion step, `/pr-review` Phase C0 and `/design-spec`; drop that
  fallback once no such story is left.
- **A record whose gate stays unclear is not written.** The skill stops and hands the case to
  the user for the Hüter-Trio — no provisional record. Only `/spec-pr` lets the spec PR go up
  without it. Declining, deleting or merging records is a team decision.
- **Spec PRs go through `/spec-pr`**, which prescribes the 📝 marker and spec description to
  `ado-toolkit:ado-pr`. `ado-toolkit` knows nothing about specs — never add SDD concepts there.
- **No ADO tasks for plan steps**, neither created nor offered.

## Policy hook

- `hooks/inject-sdd-policy.js` only reads `hooks/sdd-policy.md` and emits it as
  `additionalContext` (matcher `startup|clear|compact`). No logic in the script.
- The policy decides its applicability itself: origin on `ado.mediainterface.de` → in force;
  another origin → ask once; no git origin → not applicable.
- The prose ships into every session: no maintenance notes in it — they belong here.

## /pr-review

- Phase A.5 classifies the PR first; spec PRs (S1–S6, S6 only at a trust boundary) and
  implementation PRs (dimensions 1–7) get **separate** dimension sets. A mixed diff is an
  implementation PR, not a finding.
- One read-only subagent per dimension: `Explore` type with explicit `model: sonnet` (a skill's
  `allowed-tools` is not inherited). Dimensions 6/7 and S3/S5 stay separate dispatches — one
  reviewer holding both always drops the second job.
- Review in an isolated worktree, never the user's checkout. Review and posting are separate
  phases; only findings the user names are posted.
- Findings numbered `**[N]**`, never `N.` (the terminal renderer restarts its own counter).
  Comment recipe: German, informal „du“, at most three sentences.
