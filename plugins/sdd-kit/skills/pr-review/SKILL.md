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
  was left only in them. The branch is checked out in an
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
- The ADO connection detection (**Step 0**), **Setup Check** (sign-in confirmation),
  **Repository Mismatch Check**, **Quirks**, and **German text** rules in
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
   `reviewers` (with `isRequired` and `vote` — Phase C combines these with the thread history to
   tell whether a human review has already happened; the current vote alone does not say).
   Run the **Repository Mismatch Check** — if the PR is in a different repo than the current one,
   stop unless the user confirms (the worktree and diff would otherwise use the wrong codebase).
4. Fetch existing PR comment threads. Keep them — Phase C dedupes against points already raised
   so you never repeat a human reviewer. **Keep the system threads as well** (`commentType:
   "system"`, carrying a `CodeReviewThreadType` property): they hold the PR's history, the
   reviewers' earlier votes among it, which is how Phase C tells whether a human review has
   already happened. They are excluded from the dedupe, not from the fetch.

### Phase B — Isolate the branch in a worktree
Strip `refs/heads/` from both branch names, then from the repo root:
```bash
git fetch origin {sourceBranch} {targetBranch}
git worktree add --detach .claude/worktrees/pr-review-{id} origin/{sourceBranch}
```
- **Deleted source branch** (fetch fails): use `lastMergeSourceCommit.commitId` —
  `git fetch origin {commitId}` then `git worktree add --detach .../pr-review-{id} {commitId}`.
- The diff range for every dimension is `origin/{targetBranch}...HEAD` **inside the worktree**.
- If `git worktree add` fails, report the exact error and stop. Do not fall back to an in-place
  checkout of the user's working directory.

### Phase C — Multi-dimension review via subagents
From inside the worktree, compute the diff (`--name-status`, `--stat`, full diff, commit log
against the target) and read the CLAUDE.md files near the changed directories so the subagents
inherit the project's own conventions. Also list the repo's decision records if present —
dimension 5 needs them, on every review. Records live on **Memory Bank levels**: glob for
**every** `docs/decisions/` directory, not just the repo root's (`docs/decisions/`,
`apps/*/docs/decisions/`, `services/*/docs/decisions/`, …), and keep the ones whose level covers
the changed paths — a record in `apps/<app>/docs/decisions/` binds changes inside that app, a
root record binds everything. Then look for whatever this repo documents about testing (a test
process or strategy document, a testing section in a
CLAUDE.md / CONTRIBUTING, the conventions of the existing test suite). Dimensions 6 and 7 layer
that on top of their own checks; where the repo documents nothing, those checks still run.
Split the diffstat into test paths and production paths here — dimension 7 needs the ratio, and
it goes into the report's status header either way. Finally — **unless this PR is itself a spec
PR** (📝 marker in the title, or only spec/doc files changed; the same detection `/ado-pr` uses in
its PR-creation step 7) — check whether the branch still carries the story's **design spec or
implementation plan** (`docs/superpowers/specs/`, `docs/superpowers/plans/` — wherever this repo
keeps them), and hand their paths and content to dimension 5. **On a spec PR, skip this and say
nothing about it:** there the spec is the content under review, and asking for its deletion would
remove what the PR exists for.

Hand dimension 5 one more fact with it: is this PR **past its first review round** — has every
required reviewer seen this code at least once? Judge that from evidence, not from the current
tally: Azure DevOps clears votes on a new push, so a reviewer who reviewed and was then reset
shows no vote while their review did happen. Count all three signals — the vote a required
reviewer holds now, votes recorded earlier in the system threads from Phase A, and threads that
reviewer opened themselves. Missing all three for one required reviewer means the round is not
through. This review run is never one of the signals.

**Dispatch one subagent per dimension**, using a **read-only agent type** (`Explore`, or any
agent whose tool set excludes `Edit`/`Write`). This is what actually enforces "review only":
a skill's `allowed-tools` is **not** inherited by its subagents, so the read-only guarantee has
to live in each subagent's own tool set — a general-purpose subagent could edit files.
**Dispatch every dimension with an explicit `model: sonnet`.** A review spawns ~7 explorers at
roughly 100k tokens each; inheriting the session's model makes that disproportionately
expensive, and Sonnet handles the dimension analysis. Escalate to the session model only when
the user explicitly asks for a deeper pass. They run
in parallel; each is told the worktree path, the diff range, and the changed-file list, and
returns findings in the schema below. **Subagents post nothing.**

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
   checked out, not just the diff. Two checks that always run here:
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
     pitfall in `sdd-kit:create-lesson-learned`. Only when a criterion is met, propose the ADR:
     suggest a title, the one-sentence decision it should capture, and the **level** it belongs
     on (the smallest level whose subtree covers everyone affected — the app's `docs/decisions/`
     for a single-app decision, the root's only for one spanning apps or services).
     `sdd-kit:create-decision` can then draft it. Usually 🟢, 🟡 if the decision contradicts how
     siblings do it.
   - **Spec and plan are transient — and this review is where they go.** A design spec and an
     implementation plan belong to one story, not to the repository: they are deleted at the
     human code review of the story's **implementation**, at the latest after the first round.
     Runs only when Phase C handed over spec or plan files — on a **spec PR** it handed over
     nothing and this check does not exist. Then two checks, in this order:
     1. **Read them and look for durable content.** Per piece of reasoning: is it needed beyond
        this story? Anything that is — a constraint, the grounds for a decision, a rule — must
        already exist **outside** the spec and the plan: inline in the code as its own reason, in
        the work item, in `.claude/rules/`, or as a record. Something needed that lives only there
        is a 🟡 finding, anchored at the code it concerns, asking for the inline reason (or for a
        record, if it clears the triage above).
     2. **Then the deletion itself.** Spec and plan files still present in the branch are one 🟢
        finding anchored at the file, asking for `git rm` in this PR — 🟡 when Phase C reports the
        PR as past its first review round, because that was the deadline.

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

**Finding schema** (each subagent returns a list of these):
A finding is **something that needs a comment on a line of code**. Anything the PR page already
displays by itself (check results, test failures, build logs) is status, not a finding, and never
enters this list.

```
severity : 🔴 Blocker | 🟡 Sollte | 🟢 Optional
file     : path from repo root
line     : line number (or range)
dimension: security | consistency | smell | adr | test | test-surplus
summary  : one line — the concrete issue
why      : one sentence — why it matters, ONLY if not obvious from the line
suggestion: the concrete fix or a genuine question
```

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
half only one dimension was looking for.

The report has **two clearly separated parts**:
- **Status header** (not numbered, not postable): the CI/pipeline line — which required checks
  are green, red, or missing, plus the one-line root cause for each failed build — and the
  change's **test-to-production line ratio** (e.g. „303 Testzeilen / 183 Produktivzeilen"). The
  ratio is context for the reader, never a finding on its own.
- **Numbered findings** (the only postable part): every entry here must be worth a comment on a
  line of code. "Post all" has to be a sensible answer — so if an entry only restates something
  the PR page already shows, it belongs in the status header instead.

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
