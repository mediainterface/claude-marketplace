---
name: pr-review
description: >-
  Use when you want a thorough, triage-first review of an Azure DevOps pull request — you have a
  PR ID or URL and want more than the diff checked. Covers security, CI/pipeline status, code
  smells, dead code and drift, duplicate or divergent implementations across the wider
  codebase, test quality in both directions (tests that cannot fail if the behavior breaks, and
  tests that are redundant or over-broad), and decision records (ADRs) — violations of active
  ones, code following superseded ones, and decisions missing a record. Also checks whether the
  story's design spec and implementation plan are deleted here, and whether anything still needed
  was left only in them. A spec PR gets its own, much smaller review instead — the spec against
  its work item, against the decision records and the existing code, and its planned test
  approach against the repo's test process — because a spec has no code, no tests, and nothing
  to drift. The branch is checked out in an
  isolated worktree; findings are reported for your
  triage and only posted after you approve them. For a deep look — not the quick working-tree
  /code-review.
argument-hint: <PR_ID_OR_URL>
allowed-tools: Bash, Read, Glob, Grep, Agent, Skill
---

# Deep PR Review (triage-first, Azure DevOps)

Review an Azure DevOps pull request thoroughly, then let the user decide what gets posted.
Given a PR ID or URL, this checks out the branch in an **isolated worktree**, runs a
**multi-dimension review** (each dimension explores the code *around* the change, not only the
diff), reports the findings for **triage**, and posts **only the findings the user approves**.

The Azure DevOps plumbing lives in this plugin's sibling skills — this skill orchestrates them;
it does not re-implement `az`. **REQUIRED SUB-SKILLS:**
- **`sdd-kit:ado-pr`** — PR metadata, local diff, comment threads (its *PR Comments* workflow is
  the only way this skill posts anything).
- **`sdd-kit:ado-pipeline`** — root-cause analysis for a failed PR build.
- **`sdd-kit:ado-workitem`** — the linked work item's content (title, description, acceptance
  criteria, state) via its *show* workflow. The spec-PR review compares the spec against it.
- The ADO connection detection (**Step 0**), **Setup Check** (sign-in confirmation),
  **Repository Mismatch Check**, **Spec PR vs. implementation PR** (the kind detection Phase A.5
  applies), **Quirks**, and **German text** rules in
  [../ado-shared/REFERENCE.md](../ado-shared/REFERENCE.md) apply — complete Step 0 and the
  Setup Check once before any `az` command.

## Two hard rules

1. **Review and posting are separate phases.** The review is **read-only** and ends in a report
   to the user. Nothing is ever posted, resolved, or written to the PR during review. Posting
   happens only in a later phase, only for findings the user names.
2. **Never touch the user's checkout.** The PR branch goes into a dedicated, ephemeral worktree.
   Never check the PR branch out in the user's working directory, never switch their branch,
   never edit files (this is review-only — you diagnose, you don't fix).

## Workflow

### Phase A — Setup & PR facts (read-only)
1. Parse the PR ID from the argument (numeric ID or extract from the URL).
2. Run the shared reference's **Step 0** (connection detection) + **Setup Check** (sign-in
   confirmation). If not signed in, stop and show the sign-in instructions.
3. Fetch PR metadata (`sdd-kit:ado-pr` review step): `sourceRefName`, `targetRefName`, `title`,
   `description`, `status`, linked work items, `repository.name`, `lastMergeSourceCommit`, and
   `reviewers` (with `isRequired` and `vote` — Phase C0 combines these with the thread history to
   tell whether a human review has already happened; the current vote alone does not say).
   Run the **Repository Mismatch Check** — if the PR is in a different repo than the current one,
   stop unless the user confirms (the worktree and diff would otherwise use the wrong codebase).
4. Fetch existing PR comment threads. Keep them — Phase D dedupes against points already raised
   so you never repeat a human reviewer. **Keep the system threads as well** (`commentType:
   "system"`, carrying a `CodeReviewThreadType` property): they hold the PR's history, the
   reviewers' earlier votes among it, which is how Phase C0 tells whether a human review has
   already happened. They are excluded from the dedupe, not from the fetch.

### Phase A.5 — Determine the PR kind (this decides which review runs)
A **spec PR** and an **implementation PR** get different dimension sets in Phase C, so settle
the kind here — before the worktree, before any subagent. This is also where most of the run's
cost is decided: a spec has no tests, no production code, and nothing to drift, so putting the
code dimensions on a Markdown diff finds nothing and burns a full explorer fleet.

Strip `refs/heads/` from both branch names, then get the changed-file list — no worktree needed
yet:
```bash
git fetch origin {sourceBranch} {targetBranch}
git diff --name-only origin/{targetBranch}...origin/{sourceBranch}
```
- **Deleted source branch** (the fetch fails): use `lastMergeSourceCommit.commitId` from Phase A
  — `git fetch origin {commitId}`, then diff against `{commitId}`. Whichever ref you end up
  using is `{sourceRef}` for Phase B — do not fetch a second time there.

Classify with the shared definition — **Spec PR vs. implementation PR** in
[../ado-shared/REFERENCE.md](../ado-shared/REFERENCE.md). Four things decide it in practice:

- **The changed-file set decides; the 📝 title marker only corroborates.** Per the reference's
  **Quirks**, the CLI may hand back a title with the emoji stripped, so a missing 📝 is not
  evidence of anything. A documentation-only diff is a spec PR with or without the marker.
- **📝 in the title but source code in the diff** → review as an **implementation PR** (the
  broader set misses nothing) and note in the status header that the title no longer matches the
  PR, so the author can fix the title.
- **A mixed diff — spec or docs *and* source code** → **implementation PR**, and **not a
  finding**. A small change (a bug fix, a contained adjustment) carrying its doc update along is
  the ordinary shape; splitting it would cost more than a separate spec review is worth. Two
  consequences instead of a complaint:
  - **Do not demand the deletion** of a spec the same PR is *adding* (status `A` in
    `--name-status`) — you do not ask for a file the PR exists to introduce.
  - **The doc part still gets reviewed**, alongside the code — see Phase C0's mixed-PR note.
    Classifying it as an implementation PR must not mean the spec half goes unread.
  Only one thing about the mixture is worth a finding, and it is about scope, not form: when the
  spec describes **substantially more** than this PR delivers, the separate spec PR would have
  bought review feedback before the implementation existed, and that is now gone. That is 🟢 —
  a question about how the next one is cut, not a defect in this one.
- **Nothing here is confirmed with the user.** Unlike `/ado-pr` at creation time, the diff has
  already decided. Classify, say which kind you got and which signal proves it, and continue.

### Phase B — Isolate the branch in a worktree
Phase A.5 has already fetched, so from the repo root:
```bash
git worktree add --detach .claude/worktrees/pr-review-{id} {sourceRef}
```
`{sourceRef}` is `origin/{sourceBranch}`, or the `lastMergeSourceCommit.commitId` when the
source branch was gone.
- The diff range for every dimension is `origin/{targetBranch}...HEAD` **inside the worktree**.
- If `git worktree add` fails, report the exact error and stop. Do not fall back to an in-place
  checkout of the user's working directory.
- The worktree is needed for **both** kinds: a spec review reads the spec at the branch's state
  and searches the surrounding codebase to check the spec against it.

### Phase C — Multi-dimension review via subagents

**Two dimension sets, and Phase A.5 already picked the one that runs:** **C-I** for an
implementation PR, **C-S** for a spec PR. They are separate sets, not one set with exclusions —
a spec is judged on its own questions, not on the code questions minus the impossible ones.

#### Phase C0 — Shared preparation (both kinds)
From inside the worktree, compute the diff (`--name-status`, `--stat`, full diff, commit log
against the target) and read the CLAUDE.md files near the changed directories so the subagents
inherit the project's own conventions. Then the two inputs both sets need:

- **The repo's decision records**, if present — the ADR checks (dimension 5 / S1) need them on
  every review of either kind. Records live on **Memory Bank levels**: glob for **every**
  `docs/decisions/` directory, not just the repo root's (`docs/decisions/`,
  `apps/*/docs/decisions/`, `services/*/docs/decisions/`, …), and keep the ones whose level
  covers the changed paths — a record in `apps/<app>/docs/decisions/` binds changes inside that
  app, a root record binds everything. On a spec PR the relevant paths are the ones the spec
  **proposes to touch**, not the path the spec file itself sits at.
- **Whatever this repo documents about testing** — a test process or strategy document, a testing
  section in a CLAUDE.md / CONTRIBUTING, otherwise the conventions of the existing test suite.
  Dimensions 6 and 7 layer it on top of their own checks; on a spec PR it is the yardstick S4
  measures against. Where the repo documents nothing, the checks still run and the report says so
  instead of inventing a standard.

**Implementation PR only** — three more inputs:
- **Split the diffstat** into test paths and production paths. Dimension 7 needs the ratio, and
  it goes into the report's status header either way.
- **The story's spec and plan, if the branch still carries them** (`docs/superpowers/specs/`,
  `docs/superpowers/plans/` — wherever this repo keeps them): hand their paths and content to
  dimension 5. This asks about files **present in the worktree**, not files in the diff — a
  merged spec PR put them there, so they will not show up in this PR's changed-file list.
- **Is this PR past its first review round** — has every required reviewer seen this code at
  least once? Judge that from evidence, not from the current tally: Azure DevOps clears votes on
  a new push, so a reviewer who reviewed and was then reset shows no vote while their review did
  happen. Count all three signals — the vote a required reviewer holds now, votes recorded
  earlier in the system threads from Phase A, and threads that reviewer opened themselves.
  Missing all three for one required reviewer means the round is not through. This review run is
  never one of the signals.

**Mixed PR only (documentation *and* code) — the doc half gets reviewed too.** Phase A.5
classified it as an implementation PR, so C-I runs; a second full C-S pass would be out of
proportion to the small change this shape usually is. Hand the changed doc and spec files to the
two dimensions that already ask the right questions instead:
- **Dimension 3** gets them for one added check: **does the documentation describe what the code
  in this PR actually does?** A doc update that drifts from the change shipping next to it is the
  most valuable finding this shape offers, and no other dimension looks for it.
- **Dimension 5** gets them as **content** — does anything in them contradict an active record,
  and is reasoning that must outlive the story captured outside them? Never as deletion
  candidates: a file this PR adds is not one (Phase A.5).

**Spec PR only** — two more inputs:
- **The spec itself**, read in full: the `*-design.md` (or whatever this repo names it) the PR
  adds, plus anything riding along in the same PR — Memory Bank records, a `.claude/rules/`
  convention (`/spec-pr` bundles those deliberately, so they are part of what is under review).
- **The linked work item's content.** Take the work-item IDs from Phase A and fetch the item
  through `sdd-kit:ado-workitem`'s *show* workflow: title, description, **acceptance criteria**,
  and state. The server is German-localized — read the field names from the server instead of
  assuming them (shared reference, **German text**). A PR without a linked work item, or one
  whose work item has no acceptance criteria, is itself a result: it goes into the status header
  and S3 reports what it could not compare against.

#### Dispatch rules (both kinds)
**Dispatch one subagent per dimension**, using a **read-only agent type** (`Explore`, or any
agent whose tool set excludes `Edit`/`Write`). This is what actually enforces "review only":
a skill's `allowed-tools` is **not** inherited by its subagents, so the read-only guarantee has
to live in each subagent's own tool set — a general-purpose subagent could edit files.
**Dispatch every dimension with an explicit `model: sonnet`.** An implementation review spawns
~7 explorers at roughly 100k tokens each; inheriting the session's model makes that
disproportionately expensive, and Sonnet handles the dimension analysis. Escalate to the session
model only when the user explicitly asks for a deeper pass. They run
in parallel; each is told the worktree path, the diff range, and the changed-file list, and
returns findings in the schema below. **Subagents post nothing.**

#### Phase C-I — Implementation PR: the seven code dimensions
Runs when Phase A.5 classified this as an implementation PR. Skip this whole set on a spec PR.

1. **Security** — injection, XSS, secrets/tokens in logs or config, authn/authz gaps, unsafe
   deserialization, SSRF, OWASP-style issues. Check the trust boundaries the change touches, not
   just the changed lines.
2. **CI / pipelines — produces the status line, not findings.** Is every required check on this
   PR green? Get the PR's build-validation status (try
   `az repos pr policy list --id {prId} --org {org} -o json`; else list recent builds for the
   source branch and read `result`). For any **failed** required build, hand its `buildId` to
   `sdd-kit:ado-pipeline` for a one-line root cause.
   The result is **status information for the report header — never a numbered, postable
   finding.** A red check, a failing test, a build error: the PR page already shows all of it,
   so a comment saying so adds nothing and forces the user to exclude it instead of saying
   "post all". Report it as status and move on.
   **One exception, and it is not a CI finding:** if the root cause turns out to be a real defect
   in the changed code, that becomes a normal `smell`/`security` finding anchored at the offending
   line, worded as the defect itself („`x` ist hier `null`, wenn …") — never as „der Test schlägt
   fehl". The value is the diagnosis the pipeline doesn't give, not the red status it does.
3. **Consistency & drift** (the expensive, high-value one) — for each new function, hook,
   component, endpoint, or helper the PR introduces, **search the wider codebase** for an existing
   equivalent. Flag: a second, divergent implementation of something that already exists
   (duplicate/parallel feature); a pattern that departs from its siblings without reason; dead
   code the PR adds or leaves behind (unreferenced exports, unreachable branches, orphaned
   files); and copy-paste that should reuse an existing utility. This is why the whole branch is
   checked out, not just the diff. Two checks that always run here — plus one when Phase C0 handed
   over changed doc or spec files (a **mixed PR**): **does that documentation describe what the
   code in this PR actually does?** A doc or spec updated next to the code it describes, drifting
   from it in the same commit range, is drift of the plainest kind, and no other dimension looks
   for it. Anchor it at the documentation line that no longer holds.
   - **Component-library usage (UI changes).** In a codebase that uses a component library
     (e.g. shadcn/ui in `apps/mira-desktop`), new UI must actually use the library's components.
     Flag hand-rolled markup/CSS that replicates an existing or available library component; a
     genuinely new component belongs in the library's own path (for shadcn:
     `npx shadcn@latest add <component>` into `components/ui/`), not hand-written next to it —
     hand-rolled replicas are how the UI drifts away from the design system.
   - **Solution platform configurations (`.sln` changes).** When a PR adds a project to a
     solution, the new entry's platform set must match the solution's existing one. Flag
     re-introduced `Any CPU` / `x86` configuration lines in solutions that only build `x64`
     (all backend service solutions here) — the tooling adds them by default, they build
     nothing that ships, and they are pure noise in every future diff.
4. **Code smells & correctness** — real correctness bugs (off-by-one, null/None, unhandled
   errors, race conditions), over-complexity, naming that misleads. Skip style a linter already
   enforces. Tests are **not** this dimension's job — they are dimension 6, so the two don't
   report the same gap twice.
5. **ADR compliance & durable context — runs on every review**, not only when the change "looks
   architectural".
   If the repo keeps decision records, read every record whose topic touches the changed code —
   from **every Memory Bank level** above those paths (the app's or service's own
   `docs/decisions/` *and* the repo root's), and in **all statuses**, because the status decides
   what the finding is.
   Check each record against the code **in the worktree, at the level of the enclosing unit** —
   the whole method, class, component, or config block the diff touches — never against diff
   hunks alone: a hunk can look compliant while the surrounding unit violates the record, and
   whether a change complies often only shows in code the diff doesn't contain (the callers,
   the rest of the class, the sibling branches).
   - **Violates an active ADR** (`status: Active`): at least 🟡, usually 🔴 — the way out is to
     follow the ADR or supersede it first, never to drift past it silently.
   - **Follows a non-active ADR**: a PR that implements the pattern of a `Superseded`,
     `Deprecated`, or `Declined` record is building on an outdated decision. Flag it and point
     to what applies now (for `Superseded by NNNN`, the superseding record; otherwise the
     current convention in the surrounding code).
   - **Makes a new lasting decision without an ADR**: a new technology or dependency, a new
     cross-cutting pattern, or a deliberate deviation from an existing convention that future
     readers will ask "why?" about. Run it through the **significance triage** before proposing
     anything (structural impact / hard to reverse / precedent / cross-cutting — see
     [../memory-bank-shared/REFERENCE.md](../memory-bank-shared/REFERENCE.md)): a one-off local
     choice is **no finding**, a recurring coding rule belongs in `.claude/rules/`, an observed
     pitfall in `sdd-kit:create-lesson-learned`. A criterion counts only with **evidence you can
     name from this codebase**:
     - **Structural impact** — the existing pattern the change *replaces*. One that follows the
       established feature/route pattern applies a decision, it doesn't make one.
     - **Hard to reverse** — what a revert costs.
     - **Precedent** — the second place that exists **today**.
     - **Cross-cutting** — the concrete features/apps/teams.

     The **locality counter-check** applies even when a criterion held: one spot, one feature,
     cheap revert → **no ADR finding**, at most a 🟢 asking for an inline reason in the code.
     Only when a criterion is met, propose the ADR:
     suggest a title, the one-sentence decision it should capture, and the **level** it belongs
     on (the smallest level whose subtree covers everyone affected — the app's `docs/decisions/`
     for a single-app decision, the root's only for one spanning apps or services).
     `sdd-kit:create-decision` can then draft it. Usually 🟢, 🟡 if the decision contradicts how
     siblings do it.
   - **Spec and plan are transient — and this review is where they go.** A design spec and an
     implementation plan belong to one story, not to the repository: they are deleted at the
     human code review of the story's **implementation**, at the latest after the first round.
     Runs only when Phase C0 handed over spec or plan files. On a **spec PR** this dimension set
     never runs at all; in a **mixed PR** the spec or doc files this PR *adds* are content to
     check, never deletion candidates — you do not ask for a file the same PR introduces. Then
     two checks, in this order:
     1. **Read them and look for durable content.** Per piece of reasoning: is it needed beyond
        this story? Anything that is — a constraint, the grounds for a decision, a rule — must
        already exist **outside** the spec and the plan: inline in the code as its own reason, in
        the work item, in `.claude/rules/`, or as a record. Something needed that lives only there
        is a 🟡 finding, anchored at the code it concerns, asking for the inline reason (or for a
        record, if it clears the triage above).
     2. **Then the deletion itself.** Spec and plan files still present in the branch are one 🟢
        finding anchored at the file, asking for `git rm` in this PR — 🟡 when Phase C0 reports the
        PR as past its first review round, because that was the deadline. This covers files the
        branch **carries in** from an earlier merged spec PR, never ones this PR adds itself.

   No decision records in the repo → report the ADR part of the dimension as not applicable, don't
   silently skip it. The spec/plan check runs regardless.
6. **Test protection — does the suite actually secure the new behavior?** Runs on every review
   whose PR touches code. Where tests are generated alongside the code, they are green from the
   first run — and green proves nothing. A test written *from* the implementation confirms what
   the code currently does instead of checking what it should do; it cannot fail by construction.
   That is worse than a missing test, because every later reader reads it as coverage. So
   **judge the tests, don't count them** — a PR that adds 40 tests can still add zero protection.

   This dimension looks **only** for weak or missing protection. The opposite direction — which
   tests could be deleted without losing anything — is **dimension 7 and must stay out of this
   dispatch**: a reviewer holding both jobs at once always prioritises the gap, because a gap
   reads as the more alarming defect, and the surplus never gets reported.

   **Two inputs, in this order.**
   - **The checks below run always**, in every repo, with or without any document.
   - **Whatever this repo says about testing comes on top** — a test process or strategy
     document, a testing section in a CLAUDE.md / CONTRIBUTING, otherwise the conventions the
     existing test suite shows. Where it is more specific than the checks below (its own level
     names, required depth per change, its E2E policy), it wins. Do **not** import testing rules
     from a codebase you happen to know: levels, tooling, naming and policy differ per repo. If
     the repo documents nothing, say so in the report instead of inventing a standard.

   **The question of this dimension, per new or changed test: would this test fail if the
   behavior were wrong?** Answer it concretely — name the change to the production code that
   turns this test red. If the honest answer is „a rename" or „nothing", the test checks the
   wrong thing. You cannot run the proof (this review never edits code), so ask the question on
   the code you read and put the proposed sabotage into the finding: „brich testweise X — der
   Test bleibt grün."

   Note what this question does *not* catch, and don't try to stretch it: a test that fails
   properly but checks the same case as a test three files away passes it cleanly. That is
   dimension 7's question.

   What makes a test unable to do its job, concretely:
   - **It mirrors the implementation** — asserts that a mock was called (`toHaveBeenCalledWith`)
     instead of what came out; walks the same branches in the same order as the code it tests.
   - **It is a tautology** — the expected value is produced by the same logic, helper or constant
     the code uses, so the test follows any change in lockstep.
   - **It tests the framework or the mock, not our code** — that the state setter sets, that the
     ORM saves, that a mock returns what it was told to return.
   - **Its assertion says nothing** — `toBeDefined()`, `not.toThrow()`, a bare render, or a
     snapshot as the only check: this proves "did not crash", not "behaves correctly".
   - **It is over-mocked** — the unit's own internals mocked away until only the mocks are under
     test. Mock the external dependency, keep the inside real.
   - **Its name promises more than it checks** — „rejects an expired token" asserting only that
     no exception was thrown.
   - **It is a test class this repo's own rules forbid** — some repos ban whole categories
     (e.g. per-feature i18n or snapshot tests). A forbidden test is a finding even when it works.
   - **It is disabled or softened** — `.skip` / `.only`, commented-out cases, a weakened
     assertion, a raised timeout or a retry wrapped around a flaky test instead of a fix.

   Beyond the individual test — still only gaps:
   - **Coverage removed without replacement.** If the PR deletes or thins a test, the equivalent
     check must already exist at a lower level. Moving coverage down is fine; dropping it is a
     gap, and it is invisible in a green pipeline.
   - **A bugfix without a regression test.** A fix should come with a test that reproduces the
     bug at the lowest level where it is reproducible — otherwise nothing stops it coming back.
     Say which level you mean.
   - **New behavior with no test at all** — every acceptance-relevant branch the PR adds. If the
     repo or the linked work item records a required test depth or level for this change, measure
     against that instead of your own guess.

   **Severity guidance:** a test that cannot fail is at least 🟡, never 🟢 — it is read as
   protection for as long as it exists. 🔴 for new behavior with no meaningful test at all, and
   for coverage removed with nothing underneath.
7. **Test surplus — what could be deleted without losing a check?** Its own dimension with its
   own subagent, on every review that adds or changes tests. Surplus tests cost real money —
   maintenance, runtime, and noise in every future diff — and dimension 6 is blind to them: a
   test that fails properly but checks the same case as a test three files away passes its
   question cleanly. Nobody finds this unless somebody is looking for exactly it.

   **The question of this dimension, per new or changed test: if I delete this test, what is no
   longer checked?** If the answer is „nothing that another test doesn't already check", it can
   go.

   **The dispatch rule — this prompt carries no gap work.** It gets this question, the checks
   below, the diff and the test suite, and **nothing about missing coverage**: no acceptance
   criteria, no „is the new behavior covered", no „find missing tests". Loading it with gap work
   turns the reviewer around — a gap always looks more urgent than a surplus — and the point of
   the separate dimension is precisely that the surplus gets an undivided pass.

   **Name the competitor or drop the finding.** A redundancy claim must name the test that
   already covers the case: file plus test name. „Wirkt redundant" without that is a guess, and a
   wrong deletion suggestion costs the team its trust in the whole dimension. Search the
   **existing** suite, not just the PR's new files — the duplicate usually sits in a test that
   has been there for months.

   What to look for:
   - **The same case twice** — the same input/expectation pair in two tests, or the same matrix
     repeated at another level. Each level should carry only what only it can check.
   - **Exhaustive enumeration on one code path** — one test per enum value, status variant, field
     or locale where all of them run through the same branch. One representative case plus the
     genuine boundaries checks the same thing; the rest are copies.
   - **Proportion.** Compute the change's test lines against its production lines (split the
     diffstat into test paths and the rest) and look at the ratio. Several times more test code
     than production code is a reason to look closely — not a verdict by itself, dense logic
     legitimately needs more. Report the ratio either way so the number is on the table.
   - **Runtime relevance of what is tested** — check this by searching, not by reading the test:
     is the tested thing used at runtime the way the test uses it? A schema or contract test is
     worthless if production only derives a type from that schema and never parses with it; an
     export nothing but the test calls keeps dead code alive; a default the code always
     overwrites needs no test. Grep for the production callers of the symbol under test.
   - **Trivial by nature** — getters, setters, constructors, plain mappings without logic, or one
     test per file because the file exists.
   - **Higher than it needs to be** — a boundary or state matrix driven through the browser that
     a unit test covers just as well, an end-to-end test added for a single story or bug instead
     of a user path. Suggest moving it down rather than only deleting it.

   **Severity guidance:** a redundant test is 🟡, merely excessive breadth is 🟢 — and „das kann
   weg" is worth reporting exactly as much as „das fehlt". Never park a surplus finding at 🟢
   just because nothing is broken. A whole test file that checks nothing the suite doesn't
   already check is one 🟡 finding, not twenty 🟢 ones.

#### Phase C-S — Spec PR: the spec dimensions
Runs when Phase A.5 classified this as a spec PR. **The seven code dimensions above do not run
here.** There is no production code, no test, and nothing to drift, so they would spend a full
explorer fleet reporting the absence of things that cannot exist yet. What is worth reviewing
about a spec is whether it matches the story it serves, the decisions already taken, the code it
will land in, and the process that will judge it — while changing it still costs nothing.

Only S2 really searches the codebase, which is what makes this set cheap. Dispatch S1–S5, and S6
only when it applies.

**S1 — Memory Bank: conflicts and missing records.** The counterpart of dimension 5, applied to
what the spec **proposes** instead of to code that exists.
- **Does the spec contradict an active record?** Read every record from Phase C0 whose topic
  touches what the spec proposes, in **all statuses**. Contradicting an `Active` record is at
  least 🟡, usually 🔴 — the way out is to follow it or supersede it first, and here that is still
  cheap.
- **Does the spec build on a non-active record?** A spec adopting the pattern of a `Superseded`,
  `Deprecated`, or `Declined` decision plans against an outdated one. Point to what applies now.
- **Does the spec take a decision that needs a record?** Run the **significance triage** from
  [../memory-bank-shared/REFERENCE.md](../memory-bank-shared/REFERENCE.md) with its evidence
  named from this codebase — the existing pattern that changes, the second place that exists
  **today**, the concrete features/apps/teams, the revert cost — then the **locality
  counter-check**: one spot, one feature, cheap revert → no record, an inline reason in the code.
  A record the spec's own *Memory Bank* section already writes out gets the same triage as one
  that is merely proposed, including the records riding along in this PR (`/spec-pr` bundles
  them deliberately, so they are under review here too).
- **Is durable reasoning trapped in the spec?** This is the last cheap moment to ask. The spec is
  deleted at the implementation's code review, so everything needed beyond this story needs a
  home outside it — inline in the code as its own reason, in the work item, in `.claude/rules/`,
  or as a record (the routing table in `/spec-pr` Step 3). Something needed that lives only in
  the spec is 🟡, with the durable home named. In the implementation review the same check only
  confirms; here it still changes something.

**S2 — Consistency with the code that already exists.** The drift dimension turned around:
instead of "does this code duplicate something", ask "does this plan duplicate, contradict, or
misdescribe what is already there". The one dimension in this set that genuinely searches the
codebase — give it the room dimension 3 would have had.
- **Does the spec propose something the codebase already has?** Search for an existing equivalent
  of every component, hook, endpoint, helper, table, or config key it introduces. Finding one is
  🟡: reuse it, or state why a second implementation is wanted — decided before it is written.
- **Do the things the spec names actually exist?** Paths, modules, components, services, config
  keys it refers to. A spec resting on a module that was renamed or removed plans a change nobody
  can carry out — 🟡, and free to fix now.
- **Does the plan fit the conventions of the place it lands in?** The CLAUDE.md files of the
  affected directories, the patterns of the sibling code, and the component library where the
  repo has one — hand-rolled UI where the library has the component is dimension 3's rule,
  applied before the markup is written.

**S3 — Spec against the story (the linked work item).** Compare in **both** directions, using the
work item from Phase C0. Its own dispatch, separate from S5 on purpose: a reviewer holding both
jobs weighs the spec-internal gap higher and the comparison against the external source quietly
drops out — the same reason dimensions 6 and 7 are split.
- **Every requirement and acceptance criterion of the story has a counterpart in the spec.** One
  the spec does not address at all is 🔴, a thinly covered one 🟡. Name the criterion in the
  story's own words so the author can find it.
- **Everything the spec plans is actually asked for by the story.** What is not is scope creep —
  🟡, asking whether it belongs in a story of its own rather than assuming it does.
- **No contradiction.** The story rules something out that the spec plans in, or the spec solves a
  different problem than the story states → 🔴.
- **What you could not compare against is reported, never guessed.** No linked work item, no
  acceptance criteria, or a story too thin to compare against: say that plainly (status header
  plus one 🟡 at the spec file) instead of inventing the criteria the story should have had.
- The story's **state** goes in the status header, not into a finding: at spec time the SDD policy
  expects **Refinement**. Report a deviation; never change the state yourself.

**S4 — Planned test approach against the repo's test process.** The legitimate remainder of
dimensions 6 and 7 at spec time. „Would this test fail if the behavior were wrong" cannot be
asked — no test exists — but whether what is planned will satisfy the process that later judges
it can, and that is far cheaper to settle here than in the implementation review.
- **Does the spec say anything at all about how the result gets verified?** Silence in a repo
  whose process demands a test depth per change is 🟡.
- **Does the planned level match what the process prescribes for this kind of change?** Use this
  repo's own level names from Phase C0. An end-to-end run for a matrix the process puts on unit
  level — or a unit test where it requires an integration one — is 🟡, and this is the only moment
  it moves for free.
- **Does the spec plan a test class this repo forbids?** Where a repo bans a category (some ban
  per-feature i18n or snapshot tests), planning one is a finding **before** it is written.
- **Does the process require artefacts the spec does not plan?** A test concept, test cases on the
  work item, acceptance tests — whatever this repo actually asks for.
- **If the repo documents no test process:** say so in the report and judge against the existing
  suite's conventions. Do **not** import a policy from a codebase you happen to know — levels,
  tooling, and naming differ per repo. Identical to dimension 6's rule, and just as binding here.

**S5 — Is the spec implementable?** Its self-consistency, independent of the story.
- **Contradictions inside the spec** — two sections describing incompatible behavior.
- **Decisions left open** that the implementation would have to invent: error behavior, edge and
  boundary cases, empty and failure states, migration of existing data, concurrent access.
- **Missing non-goals**, where the scope would otherwise be read more widely than intended.
- **Prose too vague to build from** — „wird passend behandelt", „nach Bedarf": name the spot and
  ask the concrete question.
Severity by consequence: something the implementation would have to guess at is 🟡, a real
contradiction 🔴, a stylistic gap 🟢.

**S6 — Security by design (dispatch only if it applies).** Only when the spec touches a trust
boundary: authentication, authorization, external input, secrets or tokens, personal data, a new
network path or dependency. The question is whether the **design** has a hole — a check on the
wrong side of the boundary, a token somewhere that gets logged, a missing authorization step —
never whether the Markdown has one. Touches no trust boundary → skip the dispatch and say so in
one line rather than dispatching an explorer to find nothing.

**Finding schema** (each subagent returns a list of these):
A finding is **something that needs a comment on a line** — of code on an implementation PR, of
the spec on a spec PR. Anything the PR page already displays by itself (check results, test
failures, build logs) is status, not a finding, and never enters this list.

```
severity : 🔴 Blocker | 🟡 Sollte | 🟢 Optional
file     : path from repo root
line     : line number (or range)
dimension: security | consistency | smell | adr | test | test-surplus
             | spec-story | spec-tests | spec-quality
summary  : one line — the concrete issue
why      : one sentence — why it matters, ONLY if not obvious from the line
suggestion: the concrete fix or a genuine question
```

The spec dimensions reuse the existing values where the topic is the same — S1 reports `adr`,
S2 `consistency`, S6 `security` — and the three new ones belong to S3 (`spec-story`), S4
(`spec-tests`), and S5 (`spec-quality`). A spec finding anchors at the line **of the spec** that
carries the claim, so it can be posted like any other; only a finding about something entirely
missing from the spec anchors at the heading it should have followed.

`summary`, `why`, and `suggestion` are written in the simple language of the recipe below
("How findings and comments are written") **from the start** — put that requirement into every
subagent's dispatch prompt. The triage report and the posted comments reuse these fields nearly
verbatim; nothing gets simplified only at posting time.

### Phase D — Consolidate & report for triage (STOP here)
Merge the subagents' findings. Drop any that duplicate a point already in an existing PR thread
(note it as already-raised instead). Rank by severity, number them, and present a **structured
inline list** grouped as 🔴 / 🟡 / 🟢, each with `file:line`, the summary, and the suggestion.

Where dimension 6 and dimension 7 land on the same test, merge them into **one** finding at the
higher severity and say both things in it („prüft nichts, was … nicht schon prüft — und würde
auch bei falschem Verhalten grün bleiben"). Never drop the surplus half while merging: it is the
half only one dimension was looking for. On a spec PR the same applies where S3 and S5 land on
the same passage — an open decision that is also an unaddressed acceptance criterion is one
finding at the higher severity, and it keeps the story reference.

The report has **two clearly separated parts**:
- **Status header** (not numbered, not postable). Always: the **PR kind** from Phase A.5 with the
  signal that proves it, and the CI/pipeline line — which required checks are green, red, or
  missing, plus the one-line root cause for each failed build. Then, depending on the kind:
  - **Implementation PR:** the change's **test-to-production line ratio** (e.g. „303 Testzeilen /
    183 Produktivzeilen"). Context for the reader, never a finding on its own.
  - **Spec PR:** the spec's path; the linked work item with its **state** — the SDD policy expects
    **Refinement** at spec time, so report a deviation here and never change it — or the fact that
    no work item is linked at all; and every dimension that was **not** dispatched (S6 on a spec
    with no trust boundary), so the reader can tell "checked, nothing found" from "not checked".
    A marker-versus-diff contradiction from Phase A.5 belongs here too.
- **Numbered findings** (the only postable part): every entry here must be worth a comment on a
  line — of code, or of the spec. "Post all" has to be a sensible answer — so if an entry only
  restates something the PR page already shows, it belongs in the status header instead.

#### Report layout — the numbers must survive the Markdown renderer

The report is rendered as Markdown in a terminal. A line that *starts* with `1.` or `1)` is an
ordered-list item, so the renderer prints **its own** counter in front of yours („1. 1.") and
restarts that counter after every interruption — a bullet list inside a finding, a new heading.
The result looks like duplicated numbers, a severity appearing twice, and one number showing up
under two different severities. Never let the renderer number anything:

- **One `####` heading per severity group, each group exactly once**, in the order 🔴 / 🟡 / 🟢.
  Omit a group with no findings; never open a second group for a severity already used.
- **The severity emoji appears in the group heading and nowhere else.** Never put it in front of
  an individual finding: the heading already tells the reader which group they are reading, so
  repeating it on every entry only adds noise to the column the eye scans.
- **Every finding starts with the number in square brackets:** `**[3]** …`. A line never starts
  with `N.` or `N)` — those are ordered-list markers the renderer re-numbers, `**[N]**` is not.
- **Numbering runs 1..N straight through the whole report** — never restart it per group. Each
  finding appears exactly once, in exactly one group, with exactly one severity.
- Bullets *inside* a finding are fine (the ELI5 recipe asks for them when a finding enumerates) —
  they are the finding's content, never its numbering.

```
#### 🔴 Blocker

**[1]** `src/session/reconnect.ts:88`
Wenn während des Neuverbindens die Lizenz wegfällt, wird hier abgebrochen, aber kein neuer
Status gemeldet — die Toolbar zeigt dann dauerhaft „Verbinde neu…".
Vorschlag: beim Abbruch `idle` melden — oder ist das gewollt?

#### 🟢 Optional

**[2]** `src/api/users.ts:14`
`useTenantUsers` macht fast dasselbe wie das vorhandene `useUsers` — zusammenführen?
```

Then **stop and ask the user which findings to post** — offer: name the numbers ("1, 3"),
"post all", or "I'll post them myself". **Post nothing until they answer.**

### Phase E — Post approved findings (only on explicit go)
For each finding the user approved, use `sdd-kit:ado-pr`'s **PR Comments** workflow to add a
comment thread anchored to the file and line (`threadContext`). Each comment reuses the
finding's wording — it was already written per the recipe below, so posting is anchoring, not
rewriting. Report the created thread IDs. If the user chose to post themselves, post nothing.

### Phase F — Cleanup
When the review and any posting are done, remove the worktree:
`git worktree remove .claude/worktrees/pr-review-{id}` (add `--force` only if you have confirmed
it holds no changes worth keeping). Never remove the user's other worktrees.

## How findings and comments are written — simple language (ELI5), from the start

This style applies to every finding's `summary`, `why`, and `suggestion` from the moment a
review subagent writes it — the triage report and the posted comments reuse that wording nearly
verbatim, nothing is "simplified later". A finding reads like a note from a teammate — German,
informal "du" — and must be understandable for a colleague who doesn't live in this code.

The recipe, in order:

1. **The concrete observation, at the spot** — what you see at this line, named specifically
   (the symbol, the call), not "there may be an issue in this area".
2. **What goes wrong, told as a tiny concrete story** — „wenn X passiert, bleibt Y hängen".
   Skip it if the line already shows the consequence.
3. **A concrete suggestion or a genuine question** — what to do instead, or what you're unsure of.

The language contract:

- **Everyday words.** Describe what happens instead of naming the pattern or mechanism:
  „die Meldung verschwindet nie" statt „es wird kein terminaler Statusübergang emittiert".
- **No shorthand the reader must decode** — kein „i.V.m.", „vgl.", kein Feature-Kürzel; ein
  Fachbegriff ist nur dann ok, wenn die kommentierte Zeile ihn selbst benutzt.
- **At most 3 short sentences of prose per finding.** If the story doesn't fit, it is probably
  two findings — or it is an enumeration that belongs in bullets (next rule).
- **Use Markdown bullets when the finding enumerates.** Several affected spots, several options,
  several steps of the same kind: write them as one-line bullet points under a short lead-in
  sentence — a list is grasped at a glance, a block of prose is not. A single connected story
  (observation → consequence → suggestion) stays prose; don't force bullets onto it.
- No preamble („Sieht gut aus, aber…"), no restating the code back, no severity labels in the
  text, no AI throat-clearing. If something could be intentional, ask rather than assert.

**Good** (simple story, short, asks instead of asserting):
> Wenn während des Neuverbindens die Lizenz wegfällt, wird hier zwar abgebrochen, aber kein
> neuer Status gemeldet — die Toolbar zeigt dann dauerhaft „Verbinde neu…". Kannst du beim
> Abbruch z. B. `idle` melden, oder ist das gewollt?

**Good** (drift, framed as a question because it might be intentional):
> `useTenantUsers` macht fast dasselbe wie das schon vorhandene `useUsers` in `api/users.ts` —
> war das Absicht, oder können wir das zusammenführen, damit wir die Filterlogik nicht doppelt
> pflegen?

**Good** (enumeration as bullets — grasped at a glance instead of packed into prose):
> Der neue Badge existiert jetzt dreimal fast identisch:
> - `RecordingBadge` in `toolbar/`
> - `SessionBadge` in `session-list/`
> - hier noch mal inline
>
> Können wir das auf eine Komponente mit `variant`-Prop zusammenziehen?

**Bad** (technically correct, but shorthand the reader must decode):
> Der teardown-Zweig von `abortReconnectCycle` emittiert keinen terminalen Status, i.V.m.
> `onLicenseInfoChanged` → `cleanup()` persistiert der reconnecting-State im Store.

**Bad** (verbose, robotic, restates the code, no substance):
> I noticed that in this section of the code there appears to be a potential concern. The logging
> statement may inadvertently expose sensitive information. It is generally considered best
> practice to avoid logging sensitive data. Please consider refactoring this accordingly.

## Red flags — STOP

- About to add/resolve a PR comment before the user approved specific findings → you skipped the
  triage gate. Report first.
- Checking out the PR branch in the user's working directory, or `git checkout`/`git switch` in
  the main checkout → use the worktree from Phase B.
- Editing or "fixing" code → this skill reviews, it does not change code.
- Only the diff was read → the consistency/drift dimension needs the surrounding code; that is
  the point of the worktree.
- A comment that opens with praise, restates the code, or runs past three sentences of prose
  (bulleted enumerations don't count) → apply the recipe.
- A finding arrives in technical shorthand („i.V.m.", pattern names) and you plan to simplify it
  when posting → the simple-language recipe binds in Phase C already; fix the subagent prompts.
- About to report without having read the repo's decision records → the ADR dimension runs on
  every review; list **every** `docs/decisions/` above the changed paths (the app's/service's own
  and the repo root's) and check the changed code **and its enclosing units** against them
  (active ones bind, superseded ones mislead, missing ones get proposed).
- Only the root `docs/decisions/` was read in a repo with app or service levels → a record in
  `apps/<app>/docs/decisions/` binds every change inside that app. Glob all levels.
- A missing-ADR finding for a one-off local choice → the significance triage comes first
  (structural impact / hard to reverse / precedent / cross-cutting). Without a criterion there is
  no finding; a coding rule goes to `.claude/rules/`, a pitfall to `create-lesson-learned`.
- A criterion ticked without evidence from this codebase („berührt Interfaces", „setzt Präzedenz")
  → name the pattern that changes and the second place that exists **today**, or the criterion
  does not hold. A speculative second place is not a place.
- An ADR demanded for behavior that sits at one spot in one feature and reverts in a line → the
  locality counter-check beats a formally ticked criterion. That case wants an inline reason at
  the code.
- About to ask for a spec or plan to be deleted in a PR whose diff is nothing but spec and doc
  files → that is a **spec PR**, and the spec is what it exists to submit. The deletion belongs in
  the PR that implements the story, never here. Phase A.5 should have routed to C-S, where the
  check does not exist.
- A security, smell, drift, test-protection, or test-surplus explorer dispatched on a
  documentation-only diff → those are the C-I dimensions. On a spec PR they burn a full fleet to
  report that code and tests are absent, which is the whole reason Phase A.5 exists. Dispatch C-S.
- Concluded "no 📝, so implementation PR" while the diff is documentation only → per **Quirks** the
  CLI may return the title with its emoji stripped, so a missing marker proves nothing. The
  changed-file set decides.
- A mixed diff (docs **and** source code) reported as a rule violation → it is not one. A small
  change carrying its doc update along is the ordinary shape, and splitting it costs more than the
  separate spec review is worth. Classify it as an implementation PR and move on; only a spec
  describing substantially more than this PR delivers is worth a 🟢 about how the next one is cut.
- A mixed PR reviewed as if the doc half were not there → C-I runs, but Phase C0 hands the changed
  doc and spec files to dimensions 3 and 5. „Ist ein Implementations-PR" is not a reason to leave
  the documentation unread.
- The spec review ran without the linked work item → S3 has nothing to compare against, and
  inventing the acceptance criteria the story should have had is worse than reporting their
  absence. Fetch the item via `sdd-kit:ado-workitem`, or report that none is linked.
- S3 and S5 dispatched as one subagent → the spec-internal gap always wins over the comparison
  against the story, exactly as it does for dimensions 6 and 7. Two dispatches.
- A spec's test plan judged against a test process you know from another repo → S4 measures
  against **this** repo's documented process, or against the existing suite's conventions while
  saying the repo documents none.
- The test verdict is „X Tests ergänzt, sieht gut aus" → you counted instead of judging. For
  each new test, name what would have to break in the production code to turn it red.
- Applying test rules you know from elsewhere („E2E gehört auf …", „das ist ein Unit-Test") that
  this repo never wrote down → read what this repo documents about testing, or judge by the
  universal checks and say the repo documents no process. Do not import another repo's policy.
- The PR adds tests and the report contains gap findings but not a single „das kann weg" → the
  surplus question was never asked, or the gap question crowded it out. Dimensions 6 and 7 are
  separate dispatches for exactly this reason.
- About to hand the surplus dimension the acceptance criteria, „welches Verhalten ist nicht
  abgedeckt", or any other gap task → that turns it back into dimension 6 and the surplus goes
  unreported again. Its prompt carries the deletion question and nothing about missing coverage.
- A redundancy finding that doesn't name the test already covering the case (file + test name) →
  that is a guess. Find the competitor in the existing suite or drop the finding.
- A schema, contract, or validator test counted as coverage without grepping whether production
  ever runs it → a schema used only for type inference is never executed; its test checks nothing.
- A numbered finding whose content is „der Test X schlägt fehl", „die Pipeline ist rot", or a
  build error → that is the status header's job. Move it there, or turn it into a code finding
  at the line that actually causes it.
- "Post all" would post something the user has to talk you out of → the list isn't triaged yet;
  anything not worth a comment belongs in the status header, not in the numbers.
- A finding line starts with `1.`, `2.`, `1)` — or a severity heading appears a second time →
  the renderer adds its own counter and restarts it, so numbers double up and one number lands
  under two severities. Use `**[N]**`, one heading per severity, continuous 1..N.
- A severity emoji in front of a numbered finding → it belongs in the group heading alone. The
  finding starts with `**[N]**`.

## Common mistakes

| Mistake | Fix |
|---|---|
| Posting the whole report as one giant comment | One anchored thread per finding, at its file:line. |
| Repeating a point a human reviewer already made | Phase A fetched the threads — dedupe in Phase D. |
| Treating a green-but-not-required check as a Blocker | Only **required** failing checks block; note the rest. |
| Failing tests / red pipeline listed as postable findings | The PR page already shows them — status header only. A comment is warranted solely for the code defect behind the failure, anchored at its line. |
| Leaving the review worktree behind | Remove it in Phase F. |
| English comments | The team language here is German — write comments in German. |
| Findings written technical, simplified only at posting | Every subagent dispatch prompt requires the simple-language recipe; report fields are post-ready. |
| A finding that enumerates several spots posted as one prose block | Write enumerations as Markdown bullets — one line per item, short lead-in sentence. |
| Hand-rolled UI that replicates a component-library component waved through | The consistency dimension checks library usage (shadcn/ui etc.); new components go in via the library's own path. |
| Review reported without checking the decision records | The ADR dimension is mandatory on every review — no decision records found is a reported result, not a skip. |
| Only the root `docs/decisions/` read, nested levels ignored | Records live on Memory Bank levels — glob every `docs/decisions/` above the changed paths (`apps/*/`, `services/*/`, root). |
| A missing ADR claimed for a one-off local choice | Apply the significance triage first; below the bar it is a convention, a lesson learned, or nothing. |
| A criterion affirmed on a formality („legt IPC-Kanäle an" = Interfaces, „künftige Fälle" = Präzedenz) | Each criterion needs evidence from this codebase: the pattern that changes, the second place existing **today**, the concrete features/apps/teams, the revert cost. No evidence, no criterion. |
| ADR demanded although the behavior sits at one spot and reverts in a line | The locality counter-check overrides a ticked criterion — one spot, one feature, cheap revert → an inline reason in the code, no record. |
| Green tests taken as proof, tests only counted | Ask per test: would it fail if the behavior were wrong? Name the production-code change that turns it red. |
| A test that mirrors the code (mock-call assertions, tautologies, `toBeDefined()`) waved through | It cannot fail by construction and reads as coverage forever — at least 🟡, with the sabotage that stays green in the suggestion. |
| Bugfix merged without a test reproducing the bug | Ask for the regression test at the lowest level where the bug is reproducible. |
| Test coverage deleted or thinned, pipeline still green | Equivalent coverage must exist at a lower level first — otherwise it is a silent gap. |
| The repo's own test process ignored, or one from another repo assumed | Read what this repo documents about testing and layer it on top; if it documents nothing, report that instead of inventing a standard. |
| Gaps and surplus reviewed in one pass — only gaps come back | Two dimensions, two subagents: 6 asks „würde der Test bei falschem Verhalten rot?", 7 asks „was wäre ungeprüft, wenn ich ihn lösche?". |
| Redundant test parked at 🟢 or left out of the report | „Das kann weg" is worth as much as „das fehlt": redundant 🟡, mere excess breadth 🟢, a whole pointless test file one 🟡. |
| Over-testing waved through because every test is green and meaningful on its own | Ask what the suite loses without it, and check the ratio of test to production lines plus exhaustive enumerations on one code path. |
| A test whose subject is never used that way at runtime | Grep the production callers: schema only feeding type inference, export called by nothing but the test, default the code always overwrites. |
| Only `status: Active` records read | Non-active records matter too: a PR following a superseded/deprecated ADR builds on an outdated decision — flag it and point to what applies now. |
| ADR check ran against diff hunks only | Read the whole enclosing method/class/component in the worktree — a hunk can look compliant while the surrounding unit violates the record. |
| New lasting decision in the PR, no ADR, nothing said | Propose the missing ADR — suggested title plus the one-sentence decision it should capture. |
| Dimension subagents dispatched without an explicit model | They inherit the session's model — pass `model: sonnet` on every dispatch; escalate only on explicit user request. |
| Doubled numbers („1. 1."), a severity group listed twice, the same number under two severities | Findings numbered with `N.` at line start — the terminal Markdown renderer re-numbers them and restarts after every bullet list. Use `**[N]**`, one `####` heading per severity, numbering continuous 1..N. |
| Severity emoji repeated in front of every finding | The `####` group heading carries it; on the entries it is redundant noise. Findings start with `**[N]**`. |
| A spec PR reviewed with the seven code dimensions | Phase A.5 classifies first — a documentation-only diff routes to the C-S set. The code dimensions can only report that code and tests do not exist yet, at the price of a full explorer fleet. |
| PR kind decided on the 📝 marker alone | The changed-file set decides; per **Quirks** the CLI may strip the emoji from the title it returns, so a missing marker is not evidence. |
| A mixed docs + code diff reported as a rule violation | It is not one — a small change legitimately carries its doc update along, and splitting it costs more than the separate spec review is worth. Classify as an implementation PR; 🟢 only when the spec describes substantially more than the PR delivers. |
| A mixed PR's doc half left unreviewed because the PR counted as "implementation" | Phase C0 hands the changed doc/spec files to dimension 3 (does the documentation match what the code does?) and dimension 5 (records, durable context) — never as deletion candidates. |
| Spec reviewed without the linked work item | S3 then has nothing to compare against. Fetch it via `sdd-kit:ado-workitem`; if none is linked or it carries no acceptance criteria, report that instead of inventing criteria. |
| Spec compared against the story in one direction only | Both directions: acceptance criteria the spec does not address (🔴/🟡) **and** spec content the story never asked for (scope creep, 🟡). |
| Spec's test plan waved through, or judged by another repo's policy | S4 measures planned level, forbidden test classes, and required artefacts against **this** repo's process — and reports when the repo documents none. |
| An S6 explorer dispatched for a spec that touches no trust boundary | Skip the dispatch and say so in one line — the conditional dispatch is the point. |
