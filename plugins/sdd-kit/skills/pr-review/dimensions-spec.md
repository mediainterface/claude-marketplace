# /pr-review — dimension cards for a spec PR (C-S)

Reference for [SKILL.md](SKILL.md), not a skill of its own. Read it in **Phase C-S only** — an
implementation PR never loads it — and hand each card **verbatim** to the subagent of that
dimension, together with the shared dispatch block from SKILL.md (worktree path, diff range,
changed-file list, the finding schema with its evidence contract, the writing recipe). The cards
are prompt material for the explorers; the orchestrator does not paraphrase them.

**The six code dimensions do not run here.** A spec has no production code, no test, and
nothing to drift, so they would spend a full explorer fleet reporting the absence of things that
cannot exist yet. What is worth reviewing about a spec is whether it matches the story it serves,
the decisions already taken, the code it will land in, and the process that will judge it — while
changing it still costs nothing. Only S2 really searches the codebase, which is what makes this
set cheap. Dispatch S1–S5, and S6 only when it applies.

A spec finding anchors at the line **of the spec** that carries the claim; only a finding about
something entirely missing from the spec anchors at the heading it should have followed.

---

## S1 — Memory Bank: conflicts and missing records

The counterpart of card 4, applied to what the spec **proposes** instead of to code that exists.

**Checks:**
- **Does the spec contradict an active record?** Read every record from Phase C0 whose topic
  touches what the spec proposes, in **all statuses**. Contradicting an `Active` record is at
  least 🟡, usually 🔴 — the way out is to follow it or supersede it first, and here that is still
  cheap.
- **Does the spec build on a non-active record?** A spec adopting the pattern of a `Superseded`,
  `Deprecated`, or `Declined` decision plans against an outdated one. Point to what applies now.
- **Does the spec take a decision that needs a record?** Run the **significance triage** from
  [../memory-bank-shared/REFERENCE.md](../memory-bank-shared/REFERENCE.md) with its evidence
  named from this codebase — the existing pattern it breaks, the next case the rule decides, what
  the user notices, the concrete features/apps/teams, the revert cost — then the three
  **exclusions**: one feature without effect on others, nothing changed about
  appearance/stability/behavior/dev experience, a whole-app detail that is neither a product
  decision nor hard to revise → no record, an inline reason in the code. Undecidable after the
  evidence is named is a 🟢 naming both sides for the Hüter-Trio, never a demanded record. A
  record the spec's own *Memory Bank* section already writes out gets the same triage as one that
  is merely proposed, including the records riding along in this PR (`/spec-pr` bundles them
  deliberately, so they are under review here too).
- **Is durable reasoning trapped in the spec?** This is the last cheap moment to ask. The spec is
  deleted at the implementation's code review, so everything needed beyond this story needs a
  home outside it — inline in the code as its own reason, in the work item, in `.claude/rules/`,
  or as a record (the routing table in `/spec-pr` Step 3). Something needed that lives only in
  the spec is 🟡, with the durable home named. In the implementation review the same check only
  confirms; here it still changes something.

**Evidence:** the **record file** (path) and the **passage of the spec** it conflicts with; for a
missing record, the named criterion evidence; for trapped reasoning, the passage and the durable
home it should move to.

**Typical mistakes:** only the root `docs/decisions/` read; only `Active` records read; a record
demanded for a one-feature choice the exclusions cover.

---

## S2 — Consistency with the code that already exists

The drift dimension turned around: instead of "does this code duplicate something", ask "does
this plan duplicate, contradict, or misdescribe what is already there". The one dimension in this
set that genuinely searches the codebase — give it the room card 2 would have had.

**Checks:**
- **Does the spec propose something the codebase already has?** Search for an existing
  equivalent of every component, hook, endpoint, helper, table, or config key it introduces.
  Finding one is 🟡: reuse it, or state why a second implementation is wanted — decided before it
  is written.
- **Do the things the spec names actually exist?** Paths, modules, components, services, config
  keys it refers to. A spec resting on a module that was renamed or removed plans a change nobody
  can carry out — 🟡, and free to fix now.
- **Does the plan fit the conventions of the place it lands in?** The CLAUDE.md files of the
  affected directories, the patterns of the sibling code, and the component library where the
  repo has one — hand-rolled UI where the library has the component is card 2's rule, applied
  before the markup is written.

**Evidence:** the **path** of the existing equivalent and what it does (read it, a matching name
is not enough); for a missing module, the search that did not find it and, if it moved, where it
is now; for a convention, the CLAUDE.md line or sibling file that shows it.

**Typical mistakes:** an equivalent claimed on the name alone; "does not exist" after a single grep
for one spelling.

---

## S3 — Spec against the story (the linked work item)

Compare in **both** directions, using the work item from Phase C0. Its own dispatch, separate
from S5 on purpose: a reviewer holding both jobs weighs the spec-internal gap higher and the
comparison against the external source quietly drops out — the same reason cards 5 and 6 are
split.

**Checks:**
- **Every requirement and acceptance criterion of the story has a counterpart in the spec.** One
  the spec does not address at all is 🔴, a thinly covered one 🟡. Name the criterion in the
  story's own words so the author can find it.
- **Everything the spec plans is actually asked for by the story.** What is not is scope creep —
  🟡, asking whether it belongs in a story of its own rather than assuming it does.
- **No contradiction.** The story rules something out that the spec plans in, or the spec solves
  a different problem than the story states → 🔴.
- **What you could not compare against is reported, never guessed.** No linked work item, no
  acceptance criteria, or a story too thin to compare against: say that plainly (status header
  plus one 🟡 at the spec file) instead of inventing the criteria the story should have had.
- The story's **state** goes in the status header, not into a finding: at spec time the SDD
  policy expects **Refinement**. Report a deviation; never change the state yourself.

**Evidence:** the **criterion quoted** from the work item and the spec section that does or does
not cover it; for scope creep, the spec passage and the statement that the story contains nothing
asking for it.

**Typical mistakes:** compared in one direction only; the work item not fetched and criteria
invented instead.

---

## S4 — Planned test approach against the repo's test process

The legitimate remainder of cards 5 and 6 at spec time. „Would this test fail if the behavior
were wrong" cannot be asked — no test exists — but whether what is planned will satisfy the
process that later judges it can, and that is far cheaper to settle here than in the
implementation review.

**Checks:**
- **Does the spec say anything at all about how the result gets verified?** Silence in a repo
  whose process demands a test depth per change is 🟡.
- **Does the planned level match what the process prescribes for this kind of change?** Use this
  repo's own level names from Phase C0. An end-to-end run for a matrix the process puts on unit
  level — or a unit test where it requires an integration one — is 🟡, and this is the only
  moment it moves for free.
- **Does the spec plan a test class this repo forbids?** Where a repo bans a category (some ban
  per-feature i18n or snapshot tests), planning one is a finding **before** it is written.
- **Does the process require artefacts the spec does not plan?** A test concept, test cases on
  the work item, acceptance tests — whatever this repo actually asks for.
- **If the repo documents no test process:** say so in the report and judge against the existing
  suite's conventions. Do **not** import a policy from a codebase you happen to know — levels,
  tooling, and naming differ per repo. Identical to card 5's rule, and just as binding here.

**Evidence:** the **rule in this repo's process document** (path and passage) the plan misses, or
the statement that the repo documents none and the suite convention judged against instead.

**Typical mistakes:** a test plan judged against a process you know from another repo.

---

## S5 — Is the spec implementable?

Its self-consistency, independent of the story.

**Checks:**
- **Contradictions inside the spec** — two sections describing incompatible behavior.
- **Decisions left open** that the implementation would have to invent: error behavior, edge and
  boundary cases, empty and failure states, migration of existing data, concurrent access.
- **Missing non-goals**, where the scope would otherwise be read more widely than intended.
- **Prose too vague to build from** — „wird passend behandelt", „nach Bedarf": name the spot and
  ask the concrete question.

**Evidence:** the **two passages** that contradict (both lines); for an open decision, the
concrete case the implementer would have to guess at — not "error cases are missing" but which input
or state has no specified outcome.

**Severity by consequence:** something the implementation would have to guess at is 🟡, a real
contradiction 🔴, a stylistic gap 🟢.

**Typical mistakes:** dispatched together with S3 (two dispatches, always); a generic
"edge cases are missing" without naming one.

---

## S6 — Security by design (dispatch only if it applies)

Only when the spec touches a trust boundary: authentication, authorization, external input,
secrets or tokens, personal data, a new network path or dependency. The question is whether the
**design** has a hole — a check on the wrong side of the boundary, a token somewhere that gets
logged, a missing authorization step — never whether the Markdown has one. Touches no trust
boundary → skip the dispatch and say so in one line in the status header rather than dispatching
an explorer to find nothing.

**Evidence:** the **boundary** the spec describes (passage) and the step that is missing or
misplaced on it.
