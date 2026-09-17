# /pr-review — dimension cards for an implementation PR (C-I)

Reference for [SKILL.md](SKILL.md), not a skill of its own. Read it in **Phase C-I only** —
a spec PR never loads it — and hand each card **verbatim** to the subagent of that dimension,
together with the shared dispatch block from SKILL.md (worktree path, diff range, changed-file
list, the finding schema with its evidence contract, the writing recipe). The cards are prompt
material for the explorers; the orchestrator does not paraphrase them.

Each card has the same shape: the **question** the dimension answers, the **checks**, what
counts as **evidence** (a finding without it is dropped, not softened), what is **not this
dimension's job** (another card holds it, so nothing is reported twice), the **severity**
guidance, and the **typical mistakes** of exactly this dimension.

---

## 1 — Security

**Question:** does the change open a hole at a trust boundary it touches?

**Checks:** injection, XSS, secrets or tokens in logs or config, authn/authz gaps, unsafe
deserialization, SSRF, OWASP-style issues. Check the trust boundaries the change touches, not
just the changed lines: the callers that feed the changed code and the sinks it feeds.

**Evidence:** the **path from untrusted input to the sink**, named end to end — the entry point
(route, IPC channel, CLI argument, file the user controls) and the calls between it and the
line. Before claiming a check is missing, grep for it upstream: a sanitizer or authorization step
in the caller makes the line safe, and a sink no untrusted data reaches is no finding. A token
"could leak" only if you name the log line, config file, or response that carries it.

**Not this dimension's job:** code quality and correctness without a security consequence
(card 3). CI status is nobody's job in this review — the author investigates failing builds.

**Severity:** a hole with a named path from input to sink is 🔴; a missing defense-in-depth layer
behind a check that does exist is 🟡; hardening with no reachable input is at most 🟢.

**Typical mistakes:**
- "Could be injected" without naming where the untrusted data comes from → find the source
  or drop it.
- A logged object flagged for secrets without reading what the object actually holds at that
  point.

---

## 2 — Consistency & drift (the expensive, high-value one)

**Question:** does the PR add a second version of something the codebase already has, depart from
how its siblings do it, or leave code behind that nothing uses?

**Checks — for each new function, hook, component, endpoint, or helper the PR introduces, search
the wider codebase** for an existing equivalent. This is why the whole branch is checked out,
not just the diff. Flag:
- a second, divergent implementation of something that already exists (duplicate or parallel
  feature);
- a pattern that departs from its siblings without a stated reason;
- dead code the PR adds or leaves behind — unreferenced exports, unreachable branches, orphaned
  files;
- copy-paste that should reuse an existing utility.

Two checks that always run here:
- **Component-library usage (UI changes).** In a codebase that uses a component library (e.g.
  shadcn/ui in `apps/mira-desktop`), new UI must actually use the library's components. Flag
  hand-rolled markup or CSS that replicates an existing or available library component; a
  genuinely new component belongs in the library's own path (for shadcn:
  `npx shadcn@latest add <component>` into `components/ui/`), not hand-written next to it —
  hand-rolled replicas are how the UI drifts away from the design system.
- **Solution platform configurations (`.sln` changes).** When a PR adds a project to a solution,
  the new entry's platform set must match the solution's existing one. Flag re-introduced
  `Any CPU` / `x86` configuration lines in solutions that only build `x64` (all backend service
  solutions here) — the tooling adds them by default, they build nothing that ships, and they are
  pure noise in every future diff.

One more **when Phase C0 handed over changed doc or spec files (a mixed PR): does that
documentation describe what the code in this PR actually does?** A doc or spec updated next to
the code it describes, drifting from it in the same commit range, is drift of the plainest kind,
and no other dimension looks for it. Anchor it at the documentation line that no longer holds.

**Evidence:**
- For a duplicate: the **path and symbol** of the existing equivalent, and what the two do the
  same — read both bodies, a similar name is not a duplicate. Say what differs, if anything.
- For dead code: the **search** that found no caller (which patterns you grepped — the symbol,
  its string form for registries and dynamic lookups, re-exports through index files).
- For a departed pattern: the **sibling** that shows the pattern (path), so the author sees what
  to align with.

**Not this dimension's job:** whether the code is correct (card 3); whether the test suite
duplicates itself (card 6).

**Severity:** a duplicate that will be maintained twice is 🟡; a doc that now describes the wrong
behavior 🟡. **Dead code and platform noise are at least 🟡, never 🟢** — an optional finding is
the one that does not get posted, and unused code and default-generated config lines are exactly
how a codebase degrades one merge at a time. **One exception:** code this PR adds so that the
*next* PR can use it, to keep this PR small. That is legitimate only when the PR says so — the PR
description (Phase C0 hands it over) names the code and the follow-up. Declared → no finding.
Undeclared → 🟡, and the suggestion asks whether it is a leftover or prepared for a follow-up
that the description should name.

**Typical mistakes:**
- Only the diff was read → the drift question needs the surrounding code; that is the point of
  the worktree.
- A similarly named helper declared a duplicate without comparing what both do.
- An export declared dead without grepping for dynamic use (string keys, index re-exports).
- Dead code parked at 🟢 „because nothing is broken" → at least 🟡; the exception is a declared
  follow-up in the PR description, not the reviewer's guess that one might exist.
- Hand-rolled UI that replicates a component-library component waved through.

---

## 3 — Code smells & correctness

**Question:** with which concrete input or state does this code do the wrong thing?

**Checks:** real correctness bugs — off-by-one, null/None, unhandled errors, race conditions,
wrong boundary, lost error; over-complexity; naming that misleads. Skip style a linter already
enforces.

**Evidence:** the **input or state that makes the line wrong**, traced through the code in the
worktree — the caller that can deliver it, the guard that is missing on the way. A null the caller
guarantees non-null is no finding, so read the callers before claiming one. If a scenario is only
reachable in theory, say so and let the severity carry it; if you cannot name a scenario, there
is no finding.

**Not this dimension's job:** tests — card 5, so the two don't report the same gap twice;
security consequences (card 1); duplication (card 2).

**Severity:** a bug reachable in production with a named input is 🔴; a wrong result that depends
on a caller contract nobody enforces is 🟡; complexity and naming are 🟢.

**Typical mistakes:**
- "`x` could be null here" while every caller constructs `x` two lines earlier → check the
  callers.
- A finding about a pattern ("should rather …") with no input on which the current code fails.
- Style the linter enforces reported as a smell.

---

## 4 — ADR compliance & durable context — runs on every review

Not only when the change "looks architectural". No decision records in the repo → report the ADR
part as not applicable, don't silently skip it. The spec/plan check runs regardless.

**Question:** does the change violate, outdatedly follow, or silently make a decision the Memory
Bank should hold — and does the story leave reasoning behind that only its spec or plan carries?

**Records to read:** every record whose topic touches the changed code — from **every Memory Bank
level** above those paths (the app's or service's own `docs/decisions/` *and* the repo root's), in
**all statuses**, because the status decides what the finding is. Check each record against the
code **in the worktree, at the level of the enclosing unit** — the whole method, class,
component, or config block the diff touches — never against diff hunks alone: a hunk can look
compliant while the surrounding unit violates the record, and whether a change complies often only
shows in code the diff doesn't contain (the callers, the rest of the class, the sibling branches).

**Checks:**
- **Violates an active ADR** (`status: Active`): at least 🟡, usually 🔴 — the way out is to
  follow the ADR or supersede it first, never to drift past it silently.
- **Follows a non-active ADR:** a PR that implements the pattern of a `Superseded`,
  `Deprecated`, or `Declined` record is building on an outdated decision. Flag it and point to
  what applies now (for `Superseded by NNNN`, the superseding record; otherwise the current
  convention in the surrounding code).
- **Makes a new lasting decision without an ADR:** a new technology or dependency, a new
  cross-cutting pattern, or a deliberate deviation from an existing convention that future
  readers will ask "why?" about. Run it through the **significance triage** before proposing
  anything — see [../memory-bank-shared/REFERENCE.md](../memory-bank-shared/REFERENCE.md). A
  one-off local choice is **no finding**, a recurring coding rule belongs in `.claude/rules/`, an
  observed pitfall in `sdd-kit:create-lesson-learned`. A criterion counts only with **evidence you
  can name from this codebase**:
  - **Hard to reverse** — what a revert costs, and which of stack / library / data format / build
    mechanism it is.
  - **Eases future decisions** — the next case the rule decides without re-deciding. A
    speculative next case is not a case.
  - **Product decision** — what the user notices, and who would roll it back unknowingly.
  - **Breaks a pattern** — the existing pattern the change *replaces*. One that follows the
    established feature/route pattern applies a decision, it doesn't break one.
  - **Cross-cutting** — the concrete features/apps/teams.

  The three **exclusions** apply even when a criterion held — one feature without effect on
  others, nothing changed about appearance/stability/behavior/dev experience, a whole-app detail
  that is neither a product decision nor hard to revise → **no ADR finding**, at most a 🟢 asking
  for an inline reason in the code. Undecidable even after the evidence is named — evidence and
  exclusion both fitting — is a 🟢 that names both sides and suggests putting the case to the
  Hüter-Trio, never a demanded record: the author would write one that a second record has to
  supersede.
  Only when a criterion is met, propose the ADR: a title, the one-sentence decision it should
  capture, and the **level** it belongs on (the smallest level whose subtree covers everyone
  affected — the app's `docs/decisions/` for a single-app decision, the root's only for one
  spanning apps or services). `sdd-kit:create-decision` can then draft it. Usually 🟢, 🟡 if the
  decision contradicts how siblings do it.
- **Spec and plan are transient — and this review is where they go.** A design spec and an
  implementation plan belong to one story, not to the repository: they are deleted at the human
  code review of the story's **implementation**, at the latest after the first round. Runs only
  when Phase C0 handed over spec or plan files. In a **mixed PR** the spec or doc files this PR
  *adds* are content to check, never deletion candidates — you do not ask for a file the same PR
  introduces. Two checks, in this order:
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

**Evidence:** the **record file** (path) and the **unit** in the worktree that violates or
follows it, quoted at the line; for a missing record, the named criterion evidence above; for
trapped reasoning, the passage of the spec or plan and the code it concerns.

**Not this dimension's job:** duplication and dead code (card 2); test rules (cards 5 and 6).

**Typical mistakes:**
- Only the root `docs/decisions/` read in a repo with app or service levels → a record in
  `apps/<app>/docs/decisions/` binds every change inside that app. Glob all levels.
- Only `status: Active` records read → a PR following a superseded ADR builds on an outdated
  decision; flag it and point to what applies now.
- The check ran against diff hunks only → read the whole enclosing unit in the worktree.
- A missing-ADR finding for a one-off local choice, or a criterion ticked on a formality („legt
  IPC-Kanäle an" = bricht ein Pattern, „künftige Fälle" = erleichtert Entscheidungen) → evidence
  from this codebase or no criterion.
- An ADR demanded for behavior that sits at one spot in one feature and reverts in a line → the
  exclusions beat a formally ticked criterion; that case wants an inline reason at the code.
- The deletion asked for a spec this very PR adds → that file is content, not a candidate.

---

## 5 — Test protection — does the suite actually secure the new behavior?

Runs on every review whose PR touches code. Where tests are generated alongside the code, they
are green from the first run — and green proves nothing. A test written *from* the implementation
confirms what the code currently does instead of checking what it should do; it cannot fail by
construction. That is worse than a missing test, because every later reader reads it as
coverage. So **judge the tests, don't count them** — a PR that adds 40 tests can still add zero
protection.

**Question — per new or changed test: would this test fail if the behavior were wrong?** Answer
it concretely — name the change to the production code that turns this test red. If the honest
answer is „a rename" or „nothing", the test checks the wrong thing. You cannot run the proof
(this review never edits code), so ask the question on the code you read and put the proposed
sabotage into the finding: „brich testweise X — der Test bleibt grün."

**Two inputs, in this order:**
- **The checks below run always**, in every repo, with or without any document.
- **Whatever this repo says about testing comes on top** (Phase C0 hands it over) — a test
  process or strategy document, a testing section in a CLAUDE.md / CONTRIBUTING, otherwise the
  conventions the existing test suite shows. Where it is more specific than the checks below (its
  own level names, required depth per change, its E2E policy), it wins. Do **not** import testing
  rules from a codebase you happen to know: levels, tooling, naming and policy differ per repo.
  If the repo documents nothing, say so in the report instead of inventing a standard.

**What makes a test unable to do its job, concretely:**
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
- **Its name promises more than it checks** — „rejects an expired token" asserting only that no
  exception was thrown.
- **It is a test class this repo's own rules forbid** — some repos ban whole categories (e.g.
  per-feature i18n or snapshot tests). A forbidden test is a finding even when it works.
- **It is disabled or softened** — `.skip` / `.only`, commented-out cases, a weakened assertion,
  a raised timeout or a retry wrapped around a flaky test instead of a fix.

**Beyond the individual test — still only gaps:**
- **Coverage removed without replacement.** If the PR deletes or thins a test, the equivalent
  check must already exist at a lower level. Moving coverage down is fine; dropping it is a gap,
  and it is invisible in a green pipeline.
- **A bugfix without a regression test.** A fix should come with a test that reproduces the bug
  at the lowest level where it is reproducible — otherwise nothing stops it coming back. Say
  which level you mean.
- **New behavior with no test at all** — every acceptance-relevant branch the PR adds. If the
  repo or the linked work item records a required test depth or level for this change, measure
  against that instead of your own guess.

**Evidence:** for a weak test, the **sabotage** — the concrete production change that leaves it
green; for a gap, the **branch or behavior** in the production diff (file:line) and the search
of the existing suite that found no test for it. "Should be tested" without the untested branch
named is not a finding.

**Not this dimension's job — and it must stay out of this dispatch:** which tests could be
deleted without losing anything. That is **card 6**: a reviewer holding both jobs at once always
prioritises the gap, because a gap reads as the more alarming defect, and the surplus never gets
reported. A test that fails properly but checks the same case as a test three files away passes
this card's question cleanly; don't stretch the question to catch it.

**Severity:** a test that cannot fail is at least 🟡, never 🟢 — it is read as protection for as
long as it exists. 🔴 for new behavior with no meaningful test at all, and for coverage removed
with nothing underneath.

**Typical mistakes:**
- „X Tests ergänzt, sieht gut aus" → you counted instead of judging. Per test, name what would
  have to break to turn it red.
- Test rules from elsewhere („E2E gehört auf …", „das ist ein Unit-Test") that this repo never
  wrote down → read what this repo documents, or judge by the checks above and say the repo
  documents no process.
- A gap claimed without grepping the existing suite for the case → the test may sit in a file
  the PR did not touch.

---

## 6 — Test surplus — what could be deleted without losing a check?

Its own dimension with its own subagent, on every review that adds or changes tests. Surplus
tests cost real money — maintenance, runtime, and noise in every future diff — and card 5 is
blind to them. Nobody finds this unless somebody is looking for exactly it.

**Question — per new or changed test: if I delete this test, what is no longer checked?** If the
answer is „nothing that another test doesn't already check", it can go.

**The dispatch rule — this prompt carries no gap work.** It gets this question, the checks
below, the diff and the test suite, and **nothing about missing coverage**: no acceptance
criteria, no „is the new behavior covered", no „find missing tests". Loading it with gap work
turns the reviewer around — a gap always looks more urgent than a surplus — and the point of the
separate dimension is precisely that the surplus gets an undivided pass.

**What to look for:**
- **The same case twice** — the same input/expectation pair in two tests, or the same matrix
  repeated at another level. Each level should carry only what only it can check.
- **Exhaustive enumeration on one code path** — one test per enum value, status variant, field or
  locale where all of them run through the same branch. One representative case plus the genuine
  boundaries checks the same thing; the rest are copies.
- **Proportion.** Take the change's test lines against its production lines from Phase C0 and
  look at the ratio. Several times more test code than production code is a reason to look
  closely — not a verdict by itself, dense logic legitimately needs more. Report the ratio either
  way so the number is on the table.
- **Runtime relevance of what is tested** — check this by searching, not by reading the test: is
  the tested thing used at runtime the way the test uses it? A schema or contract test is
  worthless if production only derives a type from that schema and never parses with it; an
  export nothing but the test calls keeps dead code alive; a default the code always overwrites
  needs no test. Grep for the production callers of the symbol under test.
- **Trivial by nature** — getters, setters, constructors, plain mappings without logic, or one
  test per file because the file exists.
- **Higher than it needs to be** — a boundary or state matrix driven through the browser that a
  unit test covers just as well, an end-to-end test added for a single story or bug instead of a
  user path. Suggest moving it down rather than only deleting it.

**Evidence — name the competitor or drop the finding.** A redundancy claim must name the test
that already covers the case: **file plus test name**. „Wirkt redundant" without that is a guess,
and a wrong deletion suggestion costs the team its trust in the whole dimension. Search the
**existing** suite, not just the PR's new files — the duplicate usually sits in a test that has
been there for months. For runtime relevance, the evidence is the grep of production callers.

**Not this dimension's job:** whether a test can fail (card 5); the doc/spec files (card 4).

**Severity:** a redundant test is 🟡, merely excessive breadth is 🟢 — and „das kann weg" is worth
reporting exactly as much as „das fehlt". Never park a surplus finding at 🟢 just because nothing
is broken. A whole test file that checks nothing the suite doesn't already check is one 🟡
finding, not twenty 🟢 ones.

**Typical mistakes:**
- A redundancy finding that doesn't name the competing test (file + test name) → find it in the
  existing suite or drop the finding.
- A schema, contract, or validator test counted as coverage without grepping whether production
  ever runs it → a schema used only for type inference is never executed.
- Redundant test parked at 🟢, or a pointless test file reported as twenty findings.
