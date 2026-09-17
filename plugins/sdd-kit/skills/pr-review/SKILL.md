---
name: pr-review
description: >-
  Use when you want a thorough, triage-first review of an Azure DevOps pull request — you have a
  PR ID or URL and want more than the diff checked. Covers security, code smells, dead code and
  drift across the wider codebase, test quality in both directions (tests that cannot fail, tests
  that are redundant), and decision records (violated, outdated, or missing) plus whether the
  story's spec and plan are deleted here. A spec PR gets its own, much smaller review — the spec
  against its work item, the records, the existing code, and the repo's test process. Every
  finding carries the evidence that backs it or is dropped. The branch is checked out in an
  isolated worktree; findings are reported for your triage and only posted after you approve
  them. For a deep look — not the quick working-tree /code-review.
argument-hint: <PR_ID_OR_URL>
allowed-tools: Bash, Read, Glob, Grep, Agent, Skill
---

# Deep PR Review (triage-first, Azure DevOps)

Given a PR ID or URL: check the branch out in an **isolated worktree**, run one read-only
subagent per review dimension (each explores the code *around* the change, not only the diff),
report the findings for **triage**, post **only the findings the user approves**.

This file is the **workflow**. The review questions live in dimension references next to it,
loaded only for the PR kind at hand and handed to the subagents verbatim:
[dimensions-implementation.md](dimensions-implementation.md) (cards 1–6),
[dimensions-spec.md](dimensions-spec.md) (cards S1–S6), and
[finding-style.md](finding-style.md) (how every finding is worded).

**REQUIRED SUB-SKILLS** — this skill orchestrates them, it does not re-implement `az`:
- **`sdd-kit:ado-pr`** — PR metadata, comment threads; its *PR Comments* workflow is the only way
  this skill posts anything.
- **`sdd-kit:ado-workitem`** — the linked work item (title, description, acceptance criteria,
  state) via its *show* workflow; the spec review compares the spec against it.
- [../ado-shared/REFERENCE.md](../ado-shared/REFERENCE.md): **Step 0** (connection detection),
  **Setup Check**, **Repository Mismatch Check**, **Spec PR vs. implementation PR**, **Quirks**,
  **German text** — complete Step 0 and the Setup Check once before any `az` command.

## Three hard rules

1. **Review and posting are separate phases.** The review is read-only and ends in a report.
   Nothing is posted, resolved, or written to the PR until the user names findings.
2. **Never touch the user's checkout.** The PR branch goes into a dedicated worktree. Never
   switch their branch, never edit files — you diagnose, you don't fix.
3. **No finding without evidence.** Every finding names what was read in the worktree that proves
   it (contract below). Missing or failing evidence → the finding is **dropped**, not downgraded
   to 🟢: a wrong comment costs the team its trust in the whole review, a missing one costs nothing.

## Workflow

### Phase A — Setup & PR facts
1. Parse the PR ID (numeric, or from the URL).
2. Run **Step 0** + **Setup Check**. Not signed in → stop with the sign-in instructions.
3. Fetch PR metadata via `sdd-kit:ado-pr`: `sourceRefName`, `targetRefName`, `title`,
   `description`, `status`, linked work items, `repository.name`, `lastMergeSourceCommit`,
   `reviewers` (with `isRequired` and `vote`). Run the **Repository Mismatch Check** — a PR from
   another repo stops the run unless the user confirms.
4. Fetch the comment threads, **system threads included** (`commentType: "system"` with a
   `CodeReviewThreadType` property): they hold the reviewers' earlier votes, which Phase C0 needs.
   Phase D dedupes against the human threads only.

### Phase A.5 — Determine the PR kind (this decides which review runs)
Settle the kind before the worktree and before any subagent — a spec has no code and no tests, so
the code dimensions on a Markdown diff burn a full explorer fleet to find nothing.

Strip `refs/heads/` from both branch names, then:
```bash
git fetch origin {sourceBranch} {targetBranch}
git diff --name-only origin/{targetBranch}...origin/{sourceBranch}
```
Source branch deleted (fetch fails) → `git fetch origin {lastMergeSourceCommit.commitId}` and
diff against that; whichever ref you used is `{sourceRef}` for Phase B.

Classify per **Spec PR vs. implementation PR** in the shared reference:
- **The changed-file set decides; the 📝 marker only corroborates** — per **Quirks** the CLI may
  strip the emoji, so a missing marker proves nothing. Documentation-only diff → spec PR.
- **📝 in the title but source code in the diff** → implementation PR; note the stale title in
  the status header.
- **Mixed diff (docs *and* code)** → implementation PR, **not a finding** — a small change
  legitimately carries its doc update. Consequences: never demand the deletion of a spec this PR
  *adds* (`A` in `--name-status`); the doc half is still reviewed (Phase C0 hands it to cards 2
  and 4). Only a spec describing **substantially more** than the PR delivers is worth a 🟢 about
  how the next one is cut.
- **Nothing is confirmed with the user.** Say which kind you got and which signal proves it.

### Phase B — Isolate the branch in a worktree
```bash
git worktree add --detach .claude/worktrees/pr-review-{id} {sourceRef}
```
The diff range for every dimension is `origin/{targetBranch}...HEAD` **inside the worktree**. If
the command fails, report the error and stop — never fall back to the user's working directory.
Both kinds need the worktree: a spec review searches the codebase the spec will land in.

### Phase C — Multi-dimension review via subagents

#### Phase C0 — Shared preparation
From inside the worktree: the diff (`--name-status`, `--stat`, full diff, commit log against the
target) and the CLAUDE.md files near the changed paths. Then, for both kinds:
- **Decision records** — glob **every** `docs/decisions/` (root, `apps/*/`, `services/*/`, …)
  and keep those whose level covers the changed paths; on a spec PR, the paths the spec
  **proposes to touch**. Needed by card 4 / S1 on every review.
- **What this repo documents about testing** — process document, testing section in a CLAUDE.md
  or CONTRIBUTING, otherwise the existing suite's conventions. Cards 5, 6 and S4 measure against
  it; if nothing is documented, they still run and the report says so.

**Implementation PR** — four more:
- **PR title and description** for card 2: the one legitimate reason for unused code is a
  follow-up PR the description declares.
- **Diffstat split** into test and production paths (card 6; the ratio goes in the status header).
- **The story's spec and plan if the branch still carries them** (`docs/superpowers/specs/`,
  `docs/superpowers/plans/` or wherever this repo keeps them) — files **present in the
  worktree**, not in the diff, for card 4.
- **Past the first review round?** Every `isRequired` reviewer must show one of three signals: a
  current vote, an earlier vote in the system threads, a thread they opened. ADO clears votes on
  every push, so the tally alone says nothing; this run is never a signal.
- **Mixed PR:** hand the changed doc/spec files to **card 2** (does the doc describe what the code
  does?) and **card 4** (as content, never as deletion candidates).

**Spec PR** — two more:
- **The spec in full**, plus whatever rides along (records, `.claude/rules/` conventions).
- **The linked work item** via `sdd-kit:ado-workitem` *show*: title, description, **acceptance
  criteria**, state — field names read from the German-localized server. No work item or no
  criteria is a result: status header, and S3 reports what it could not compare against.

#### Dispatch rules
1. **Read the dimension reference for this kind only.**
2. **One subagent per card, read-only agent type** (`Explore`, or any agent without
   `Edit`/`Write`). A skill's `allowed-tools` is **not** inherited, so the guarantee has to live in
   the subagent's own tool set.
3. **Explicit `model: sonnet` on every dispatch.** Six explorers at ~100k tokens each on the
   session model is disproportionate; escalate only when the user asks for a deeper pass.
4. **Prompt = the card verbatim + the shared block:** worktree path, diff range, changed-file
   list, the Phase C0 inputs the card asks for, the finding schema and contract below, and
   `finding-style.md`. Cards that must stay apart (5 and 6, S3 and S5) never share a prompt.
5. Parallel; findings in the schema; **subagents post nothing**.

#### Finding schema and contract
A finding is **something that needs a comment on a line and would make the author change
something.** CI status is not this review's job — a red build is the author's to investigate.

```
severity  : 🔴 Blocker | 🟡 Sollte | 🟢 Optional
file      : path from repo root
line      : line number (or range)
dimension : security | consistency | smell | adr | test | test-surplus
              | spec-story | spec-tests | spec-quality
summary   : one line — the concrete issue
why       : one sentence — why it matters, ONLY if not obvious from the line
suggestion: the concrete fix or a genuine question
evidence  : what was read in the worktree that proves it
```
S1 reports `adr`, S2 `consistency`, S6 `security`; S3–S5 the three `spec-*` values.

**Evidence** is not shown to the author; it lets the orchestrator tell a checked finding from a
guess. Each card says what counts for its dimension; the common shape is **the place read**
beyond the diff hunk (caller, enclosing unit, competing test, existing equivalent, record), **the
concrete case** that makes the finding true (an empty list, an expired token, "change X and the
test stays green"), or **the search** behind a claimed absence (what was grepped for). A subagent
that cannot fill it **does not report the finding**; hedges ("possibly", "could", "should be
checked") are the symptom. Dropping is always allowed, inventing never.

### Phase D — Consolidate & report for triage (STOP here)
1. **Evidence check.** Drop every finding whose evidence is missing, names a place that does not
   say what it claims, or rests on an unreachable case; count them for the status header.
   Spot-check the expensive ones (a deletion suggestion, a 🔴) against the worktree.
2. **Would the author act on it?** Taste, a hypothetical without a path, a restatement of what the
   code visibly does → drop, or turn into a genuine question if the intent is really unclear.
   "Post all" has to be a sensible answer.
3. **Dedupe** against the human PR threads (note as already-raised). Where cards 5 and 6 — or S3
   and S5 — land on the same spot, merge into **one** finding at the higher severity that says
   both things; never drop the surplus half.
4. **Rank by severity, number 1..N.**

**Status header** (not numbered, not postable): PR kind with the signal proving it; findings
dropped for lack of evidence; then per kind — implementation: test-to-production line ratio,
„no decision records" / „no documented test process" where true; spec: the spec's path, the
work item with its **state** (the policy expects **Refinement**; report, never change), or that
none is linked, every dimension **not** dispatched (S6 without a trust boundary), a stale 📝.

**Numbered findings** (the only postable part), laid out so the terminal renderer cannot
re-number them: one `####` heading per severity in the order 🔴 / 🟡 / 🟢 (omit empty, never
repeat), the emoji **only** in the heading, every finding starting `**[N]** ` — never `N.` or
`N)` — numbered 1..N across the whole report. Bullets inside a finding are content, fine.

```
#### 🔴 Blocker

**[1]** `src/session/reconnect.ts:88`
Wenn während des Neuverbindens die Lizenz wegfällt, wird hier abgebrochen, aber kein neuer
Status gemeldet — die Toolbar zeigt dann dauerhaft „Verbinde neu…".
Vorschlag: beim Abbruch `idle` melden — oder ist das gewollt?

#### 🟡 Sollte

**[2]** `src/api/users.ts:14`
`useTenantUsers` macht fast dasselbe wie das vorhandene `useUsers` — zusammenführen?
```

Then **stop and ask which findings to post**: numbers ("1, 3"), "post all", or "I'll post them
myself". **Post nothing until they answer.**

### Phase E — Post approved findings (only on explicit go)
For each approved finding, `sdd-kit:ado-pr` **PR Comments** workflow, one thread anchored at the
file and line (`threadContext`), the finding's wording as is — `evidence` stays out. Report the
thread IDs. "I'll post them myself" → post nothing.

### Phase F — Cleanup
`git worktree remove .claude/worktrees/pr-review-{id}` (`--force` only after confirming it holds
nothing worth keeping). Never remove the user's other worktrees.

## Red flags — STOP

Orchestration mistakes; the per-dimension ones live on the cards.

- Posting or resolving anything before the user named findings → report first.
- `git checkout`/`git switch` in the user's checkout, or editing code → worktree, review only.
- A finding with empty `evidence`, or kept as 🟢 "just in case" → drop it, count it.
- „Der Test X schlägt fehl", „die Pipeline ist rot" as a finding → CI is not this review's job.
  Drop it, unless the subagent named the code defect behind it — then it is a code finding.
- A card paraphrased into the prompt, or cards 5 and 6 / S3 and S5 in one dispatch → verbatim,
  separate: the gap always crowds out the surplus, the internal gap the story comparison.
- Code explorers on a documentation-only diff, or "no 📝, so implementation PR" → the file set
  decides; route to C-S.
- A mixed diff reported as a violation, or its doc half left unread → neither. Cards 2 and 4.
- Spec review without the linked work item → fetch it or report that none is linked.
- Report without the decision records → glob every `docs/decisions/` above the changed paths.
- A dispatch without `model: sonnet` → it inherits the session model.
- A finding line starting `1.`/`1)`, a repeated severity heading, an emoji before a number → the
  renderer re-numbers. `**[N]**`, one heading per severity, 1..N.
- One giant comment, English comments, the worktree left behind → one German thread per finding,
  then Phase F.
