---
name: pr-review
description: >-
  Use when you want a thorough, triage-first review of an Azure DevOps pull request — you have a
  PR ID or URL and want more than the diff checked. Covers security, code smells, dead code and
  drift, duplicate or divergent implementations across the wider codebase, test quality in both
  directions (tests that cannot fail if the behavior breaks, and tests that are redundant or
  over-broad), and decision records (ADRs) — violations of active
  ones, code following superseded ones, and decisions missing a record. Also checks whether the
  story's design spec and implementation plan are deleted here, and whether anything still needed
  was left only in them. A spec PR gets its own, much smaller review instead — the spec against
  its work item, against the decision records and the existing code, and its planned test
  approach against the repo's test process — because a spec has no code, no tests, and nothing
  to drift. Every finding carries the evidence that backs it or is dropped. The branch is checked
  out in an isolated worktree; findings are reported for your triage and only posted after you
  approve them. For a deep look — not the quick working-tree /code-review.
argument-hint: <PR_ID_OR_URL>
allowed-tools: Bash, Read, Glob, Grep, Agent, Skill
---

# Deep PR Review (triage-first, Azure DevOps)

Review an Azure DevOps pull request thoroughly, then let the user decide what gets posted.
Given a PR ID or URL, this checks out the branch in an **isolated worktree**, runs a
**multi-dimension review** (each dimension explores the code *around* the change, not only the
diff), reports the findings for **triage**, and posts **only the findings the user approves**.

This file is the **workflow**. The review questions themselves live in two dimension references
next to it, loaded only for the PR kind at hand and handed to the subagents verbatim:
[dimensions-implementation.md](dimensions-implementation.md) (cards 1–6) and
[dimensions-spec.md](dimensions-spec.md) (cards S1–S6).

The Azure DevOps plumbing lives in this plugin's sibling skills — this skill orchestrates them;
it does not re-implement `az`. **REQUIRED SUB-SKILLS:**
- **`sdd-kit:ado-pr`** — PR metadata, local diff, comment threads (its *PR Comments* workflow is
  the only way this skill posts anything).
- **`sdd-kit:ado-workitem`** — the linked work item's content (title, description, acceptance
  criteria, state) via its *show* workflow. The spec-PR review compares the spec against it.
- The ADO connection detection (**Step 0**), **Setup Check** (sign-in confirmation),
  **Repository Mismatch Check**, **Spec PR vs. implementation PR** (the kind detection Phase A.5
  applies), **Quirks**, and **German text** rules in
  [../ado-shared/REFERENCE.md](../ado-shared/REFERENCE.md) apply — complete Step 0 and the
  Setup Check once before any `az` command.

## Three hard rules

1. **Review and posting are separate phases.** The review is **read-only** and ends in a report
   to the user. Nothing is ever posted, resolved, or written to the PR during review. Posting
   happens only in a later phase, only for findings the user names.
2. **Never touch the user's checkout.** The PR branch goes into a dedicated, ephemeral worktree.
   Never check the PR branch out in the user's working directory, never switch their branch,
   never edit files (this is review-only — you diagnose, you don't fix).
3. **No finding without evidence.** Every finding names what was read in the worktree that
   proves it (the finding contract below). A finding whose evidence is missing or does not hold
   is **dropped**, not downgraded to 🟢 — a wrong comment costs the team its trust in the whole
   review, a missing one costs nothing.

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
  finding**. A small change carrying its doc update along is the ordinary shape; splitting it
  would cost more than a separate spec review is worth. Two consequences instead of a complaint:
  - **Do not demand the deletion** of a spec the same PR is *adding* (status `A` in
    `--name-status`) — you do not ask for a file the PR exists to introduce.
  - **The doc part still gets reviewed**, alongside the code — Phase C0 hands it to cards 2
    and 5. Classifying it as an implementation PR must not mean the spec half goes unread.
  Only one thing about the mixture is worth a finding, and it is about scope, not form: when the
  spec describes **substantially more** than this PR delivers, the separate spec PR would have
  bought review feedback before the implementation existed. That is 🟢 — a question about how
  the next one is cut, not a defect in this one.
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

- **The repo's decision records**, if present — the ADR checks (card 4 / S1) need them on every
  review of either kind. Records live on **Memory Bank levels**: glob for **every**
  `docs/decisions/` directory, not just the repo root's (`docs/decisions/`,
  `apps/*/docs/decisions/`, `services/*/docs/decisions/`, …), and keep the ones whose level
  covers the changed paths — a record in `apps/<app>/docs/decisions/` binds changes inside that
  app, a root record binds everything. On a spec PR the relevant paths are the ones the spec
  **proposes to touch**, not the path the spec file itself sits at.
- **Whatever this repo documents about testing** — a test process or strategy document, a testing
  section in a CLAUDE.md / CONTRIBUTING, otherwise the conventions of the existing test suite.
  Cards 5 and 6 layer it on top of their own checks; on a spec PR it is the yardstick S4 measures
  against. Where the repo documents nothing, the checks still run and the report says so instead
  of inventing a standard.

**Implementation PR only** — four more inputs:
- **The PR title and description** from Phase A, for card 2: code added for a declared follow-up
  PR is the one legitimate reason for unused code, and only the description can declare it.
- **Split the diffstat** into test paths and production paths. Card 6 needs the ratio, and it
  goes into the report's status header either way.
- **The story's spec and plan, if the branch still carries them** (`docs/superpowers/specs/`,
  `docs/superpowers/plans/` — wherever this repo keeps them): hand their paths and content to
  card 4. This asks about files **present in the worktree**, not files in the diff — a merged
  spec PR put them there, so they will not show up in this PR's changed-file list.
- **Is this PR past its first review round** — has every required reviewer seen this code at
  least once? Judge that from evidence, not from the current tally: Azure DevOps clears votes on
  a new push, so a reviewer who reviewed and was then reset shows no vote while their review did
  happen. Count all three signals — the vote a required reviewer holds now, votes recorded
  earlier in the system threads from Phase A, and threads that reviewer opened themselves.
  Missing all three for one required reviewer means the round is not through. This review run is
  never one of the signals.

**Mixed PR only (documentation *and* code) — the doc half gets reviewed too.** Phase A.5
classified it as an implementation PR, so C-I runs; a second full C-S pass would be out of
proportion to the small change this shape usually is. Hand the changed doc and spec files to
**card 2** (does the documentation describe what the code in this PR actually does?) and
**card 4** (as content — records, durable context — never as deletion candidates).

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
1. **Read the dimension reference for this kind** — `dimensions-implementation.md` on an
   implementation PR, `dimensions-spec.md` on a spec PR — and never the other one.
2. **Dispatch one subagent per card**, using a **read-only agent type** (`Explore`, or any agent
   whose tool set excludes `Edit`/`Write`). This is what actually enforces "review only": a
   skill's `allowed-tools` is **not** inherited by its subagents, so the read-only guarantee has
   to live in each subagent's own tool set — a general-purpose subagent could edit files.
3. **Every dispatch carries an explicit `model: sonnet`.** An implementation review spawns ~6
   explorers at roughly 100k tokens each; inheriting the session's model makes that
   disproportionately expensive, and Sonnet handles the dimension analysis. Escalate to the
   session model only when the user explicitly asks for a deeper pass.
4. **Each prompt = the card verbatim + the shared dispatch block:** the worktree path, the diff
   range, the changed-file list, the Phase C0 inputs the card asks for, the **finding schema and
   contract** below, and the **writing recipe** below. Cards that must stay apart (6 and 7, S3
   and S5) never share a prompt — each card says what is not its job, and that text goes along.
5. They run in parallel and return findings in the schema. **Subagents post nothing.**

#### Finding schema and contract (every subagent, both kinds)
A finding is **something that needs a comment on a line** — of code on an implementation PR, of
the spec on a spec PR — **and that would make the author change something.** CI status is not
part of this review: a red pipeline or a failing test is the author's to investigate, and
anything the PR page already displays by itself never enters this list.

```
severity  : 🔴 Blocker | 🟡 Sollte | 🟢 Optional
file      : path from repo root
line      : line number (or range)
dimension : security | consistency | smell | adr | test | test-surplus
              | spec-story | spec-tests | spec-quality
summary   : one line — the concrete issue
why       : one sentence — why it matters, ONLY if not obvious from the line
suggestion: the concrete fix or a genuine question
evidence  : what was read in the worktree that proves it (see the contract)
```

The spec dimensions reuse the existing values where the topic is the same — S1 reports `adr`,
S2 `consistency`, S6 `security` — and the three new ones belong to S3 (`spec-story`), S4
(`spec-tests`), and S5 (`spec-quality`).

**The evidence contract.** `evidence` is not shown to the author; it is what lets the
orchestrator and the user tell a checked finding from a guess. Each card defines what counts for
its dimension; the common shape is:
- **The place read** — file and lines in the worktree beyond the diff hunk (the caller, the
  enclosing unit, the competing test, the existing equivalent, the record).
- **The concrete case** — the input, state, or production change that makes the finding true
  (an empty list, an expired token, "change X and the test stays green").
- **The search**, where the claim is an absence (no caller, no test, no equivalent): what was
  grepped for, so a missed spelling can be spotted.

A subagent that cannot fill `evidence` for a finding **does not report it**. Hedges in a summary
("possibly", "could", "should be checked") are signs of exactly that. Dropping a finding is
always allowed; inventing one never is.

### Phase D — Consolidate & report for triage (STOP here)
Merge the subagents' findings, then filter and rank:

1. **Evidence check.** Read each finding's `evidence`. Where it is missing, names a place that
   does not say what it claims, or rests on a case the code cannot reach, **drop the finding**
   and note it in one line under the status header ("N findings dropped for lack of evidence").
   Spot-check the rest against the worktree where the claim is expensive if wrong (a deletion
   suggestion, a 🔴).
2. **Would the author act on it?** A finding nobody would change anything for — a matter of
   taste, a hypothetical without a path, a restatement of what the code visibly does — goes, or
   becomes a genuine question if the intent is really unclear. "Post all" has to be a sensible
   answer to this list.
3. **Dedupe.** Drop any finding that duplicates a point already in an existing PR thread (note it
   as already-raised instead). Where cards 5 and 6 land on the same test, merge them into
   **one** finding at the higher severity and say both things in it („prüft nichts, was … nicht
   schon prüft — und würde auch bei falschem Verhalten grün bleiben"). Never drop the surplus
   half while merging: it is the half only one dimension was looking for. On a spec PR the same
   applies where S3 and S5 land on the same passage — one finding at the higher severity, keeping
   the story reference.
4. **Rank by severity and number 1..N.**

The report has **two clearly separated parts**:
- **Status header** (not numbered, not postable). Always: the **PR kind** from Phase A.5 with the
  signal that proves it, and the count of findings dropped in the evidence check. Then, depending
  on the kind:
  - **Implementation PR:** the change's **test-to-production line ratio** (e.g. „303 Testzeilen /
    183 Produktivzeilen"). Context for the reader, never a finding on its own. "No decision
    records in this repo" and "no documented test process" go here too.
  - **Spec PR:** the spec's path; the linked work item with its **state** — the SDD policy
    expects **Refinement** at spec time, so report a deviation here and never change it — or the
    fact that no work item is linked at all; and every dimension that was **not** dispatched (S6
    on a spec with no trust boundary), so the reader can tell "checked, nothing found" from "not
    checked". A marker-versus-diff contradiction from Phase A.5 belongs here too.
- **Numbered findings** (the only postable part): every entry here must be worth a comment on a
  line — of code, or of the spec — and survive steps 1 and 2 above.

#### Report layout — the numbers must survive the Markdown renderer

The report is rendered as Markdown in a terminal. A line that *starts* with `1.` or `1)` is an
ordered-list item, so the renderer prints **its own** counter in front of yours („1. 1.") and
restarts it after every interruption — a bullet list inside a finding, a new heading. Never let
the renderer number anything:

- **One `####` heading per severity group, each group exactly once**, in the order 🔴 / 🟡 / 🟢.
  Omit a group with no findings; never open a second group for a severity already used.
- **The severity emoji appears in the group heading and nowhere else** — never in front of an
  individual finding.
- **Every finding starts with the number in square brackets:** `**[3]** …`. A line never starts
  with `N.` or `N)`.
- **Numbering runs 1..N straight through the whole report** — never restart it per group.
- Bullets *inside* a finding are fine (the recipe asks for them when a finding enumerates) —
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
rewriting; `evidence` stays out of the comment. Report the created thread IDs. If the user chose
to post themselves, post nothing.

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
  several steps of the same kind: one-line bullets under a short lead-in sentence. A single
  connected story (observation → consequence → suggestion) stays prose.
- No preamble („Sieht gut aus, aber…"), no restating the code back, no severity labels in the
  text, no AI throat-clearing. If something could be intentional, ask rather than assert.

**Good** (simple story, short, asks instead of asserting):
> Wenn während des Neuverbindens die Lizenz wegfällt, wird hier zwar abgebrochen, aber kein
> neuer Status gemeldet — die Toolbar zeigt dann dauerhaft „Verbinde neu…". Kannst du beim
> Abbruch z. B. `idle` melden, oder ist das gewollt?

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

**Bad** (verbose, restates the code, no substance — and no evidence a reviewer could check):
> I noticed that in this section of the code there appears to be a potential concern. The logging
> statement may inadvertently expose sensitive information. Please consider refactoring this.

## Red flags — STOP

Orchestration mistakes. The per-dimension ones live on the cards.

- About to add/resolve a PR comment before the user approved specific findings → you skipped the
  triage gate. Report first.
- Checking out the PR branch in the user's working directory, or `git checkout`/`git switch` in
  the main checkout → use the worktree from Phase B.
- Editing or "fixing" code → this skill reviews, it does not change code.
- A finding with an empty `evidence`, or one you would keep as a 🟢 "just in case" → drop it.
  Uncertain findings are not downgraded, they are removed; the count goes in the status header.
- A summary that hedges ("possibly", "could", "should be checked") → the subagent did not
  check. Either the evidence names the case, or the finding goes.
- A finding whose content is „der Test X schlägt fehl", „die Pipeline ist rot", or a build error →
  CI is not this review's job; the author investigates failures. Drop it — unless the subagent
  named the code defect behind it, which is then an ordinary finding at the causing line.
- "Post all" would post something the user has to talk you out of → the list isn't triaged yet;
  anything not worth a comment belongs in the status header, not in the numbers.
- A finding arrives in technical shorthand and you plan to simplify it when posting → the
  recipe binds in Phase C already; fix the subagent prompts.
- A comment that opens with praise, restates the code, or runs past three sentences of prose
  (bulleted enumerations don't count) → apply the recipe.
- Cards 5 and 6 — or S3 and S5 — dispatched as one subagent → the gap always wins over the
  surplus, the spec-internal gap over the comparison against the story. Two dispatches.
- The card text paraphrased into the prompt instead of passed verbatim → the checks and the
  evidence rules get lost in the summary. Hand over the card.
- A security, smell, drift, or test explorer dispatched on a documentation-only diff → that is a
  spec PR; Phase A.5 should have routed to C-S. Concluded "no 📝, so implementation PR" while the
  diff is documentation only → the changed-file set decides, the marker proves nothing.
- A mixed diff (docs **and** code) reported as a rule violation, or reviewed as if the doc half
  were not there → neither. Implementation PR, and Phase C0 hands the doc files to cards 2 and 4.
- The spec review ran without the linked work item → S3 has nothing to compare against. Fetch it
  via `sdd-kit:ado-workitem`, or report that none is linked.
- About to report without having read the repo's decision records → card 4 / S1 runs on every
  review; glob **every** `docs/decisions/` above the changed paths.
- Dimension subagents dispatched without an explicit model → they inherit the session's model.
  Pass `model: sonnet` on every dispatch.
- A finding line starts with `1.`, `2.`, `1)`, a severity heading appears a second time, or an
  emoji sits in front of a numbered finding → the renderer re-numbers. `**[N]**`, one heading per
  severity, continuous 1..N.
- Posting the whole report as one comment, posting in English, or leaving the worktree behind →
  one anchored German thread per finding, then Phase F.
