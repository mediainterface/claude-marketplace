# Project SDD policy

This policy describes MediaInterface's Spec-Driven-Development (SDD) workflow. The
rules below are **project-level instructions and OVERRIDE the superpowers skills
where they conflict** — project/user instructions take precedence over skills.

## Does this policy apply here?

The SDD workflow is for MediaInterface repos. When the policy first becomes
relevant in a session — e.g. a spec has just been approved, or a Memory Bank record
is about to be proposed — check the project's git origin (`git remote get-url
origin`) if you do not already know it:

- Origin on `ado.mediainterface.de` (any URL form) → the policy is **in force**;
  follow it.
- Any other origin → not automatically in force: **ask the user once** whether this
  project should follow the SDD workflow, and follow it only on an explicit yes.
- No git repository or no origin → the policy does not apply. Do **not** ask;
  follow it only if the user explicitly requests the SDD workflow.

## Spec → PR before implementation

Once the superpowers `brainstorming` skill has produced a design spec and the user
has approved it, do **not** invoke the `writing-plans` skill and do **not** write an
implementation plan or any code. Instead, invoke the `sdd-kit:spec-pr` skill, which
opens a pull request for the spec (plus any Memory Bank items) and then stops until
the PR is merged.

The implementation plan (`writing-plans`) happens only **after** the spec PR is
merged, as a separate later effort. Proceed to `writing-plans` now **only** if the
user explicitly asks for an implementation plan in this session.

**Specs and plans are transient — capture durable context before the spec PR.** A
design spec and an implementation plan are working artifacts of one story, not
documentation: they are deleted again at the human code review of the story's
implementation (see "Implementation" below for which review that is, and which it is
not). The superpowers skills keep writing them to
`docs/superpowers/` and committing them — that stays as it is; this policy overrides
only how long they live.

So while the spec is being written, look for everything in it that is needed
**beyond** this user story and this spec — the grounds for a decision, a constraint,
a rule — and make sure it is captured **outside** the spec. Each such item has
exactly one durable home:

- **Inline in the code**, as its own reason next to what it explains (written with
  the implementation) — the default for anything that only makes sense there.
- **In the user story** — requirement, acceptance criterion, scope boundary.
- **In a convention** under `.claude/rules/` — a recurring "how we write code" rule.
- **In the Memory Bank** as a Decision Record or Lesson Learned — subject to the
  significance triage below.

Whatever matters only while this story is being built stays in the spec and goes away
with it; that is intended, and no reason to inflate the Memory Bank. But anything
needed later that lives **only** in the spec is lost when the spec is deleted — raise
it with the user **before** the spec PR is opened. The check at code review only
confirms this one.

**Ticket state.** If a work item / ticket is referenced during spec creation, check
its state (via `sdd-kit:ado-workitem`): it should be in the **Refinement** state. If
it is not, **point this out to the user** so they can correct it — do not change the
state yourself.

## Memory Bank records: significance & placement

Before proposing or creating a Decision Record, apply the significance
triage: a record is warranted only if the decision has **structural
impact** (structure, interfaces, dependencies, or quality attributes), is
**hard to reverse**, sets a **precedent** future code should follow, or is
**cross-cutting** (spans features, apps, or teams). Otherwise do not
propose one — a recurring coding rule belongs in `.claude/rules/`
(convention), an observed pitfall in `/create-lesson-learned`, and a
one-off local design choice inline in the code as its own reason. The
spec and the PR description are **not** a storage location: both are
transient.

Records live on Memory Bank **levels**: place each record in the
`docs/decisions/` (or `docs/learnings/`) of the right level. A record
lives on the smallest level whose subtree contains everyone affected —
the repo root only for matters spanning multiple apps/services (or
repo-wide/process ones); `apps/<app>/` or `services/<service>/` for
single-app records, even feature-spanning ones. Details: the
`sdd-kit:create-decision` skill and its shared reference.

*Maintenance note: this section is a deliberate summary — the source of truth
is the sdd-kit shared reference (`skills/memory-bank-shared/REFERENCE.md`).
When the Hüter-Trio changes the criteria there, sync this section.*

## Implementation: user story state

This part applies during implementation — after the spec PR has merged, when the
plan is actually written and executed.

When a user story is referenced (an existing Azure DevOps user story, mentioned by
ID), **check its state**: during implementation it should be in the
**Implementation** state; if it is not, **point this out to the user** so they can
correct it — do not change the story's state yourself.

Do **not** create Azure DevOps tasks for the plan's todo items — neither
automatically nor by offering it. Plan steps are tracked in the plan alone; they
add no value as work items for human readers.

**Delete the spec and the plan in the implementation PR, at its human code review.**
The story's design spec and implementation plan leave the repository when its
implementation goes to **code review** — at the latest after the first review round.
This is a step of its own, tied to nothing else in the workflow.

**Which review is meant — settle this before deleting anything.** "Code review" here
means the **human** review of the story's **implementation** pull request, and
nothing else:

- **Not your own reading of the code.** You review constantly while implementing, and
  none of it is the trigger — neither a `/code-review` nor an `sdd-kit:pr-review` run
  you started yourself.
- **Never in a spec PR — only in the PR that implements the story.** This is the
  confusion to expect, because a spec PR matches the pattern you are looking for from
  the outside: a pull request in review with a spec file in it. It is the opposite
  situation. A spec PR *adds* the spec and exists to get it reviewed; deleting it
  there empties the pull request. Two ways to tell them apart, and either is enough:
  the implementation PR **changes production code** (a diff of nothing but spec and
  doc files is never the right PR), and by the time you implement, the spec PR has
  long been merged — you cannot still be standing in it.
- **A review round is complete when every required reviewer has looked at this code
  once** — which is not the same as "holds a vote right now". Azure DevOps clears
  votes on a new push, so a reviewer who reviewed and then got reset shows no vote at
  all; that review still happened. What you need is **evidence that each required
  reviewer has seen the code once**: a vote they hold now, a vote they held earlier
  (the PR's system threads keep that history), or comment threads they opened
  themselves. No evidence for one of them → the round is not through. Your own pass
  over the code is never evidence.

Before that, leave both files alone, even when the plan is fully worked off: the
reviewers read the spec alongside the change in the first round, which is exactly why
the deadline sits *after* that round and not at PR creation. Once the round is done,
carrying the deletion out is your job — say what you are removing, then do it:

1. **Counter-check first.** Is everything that is needed beyond the story and the
   spec captured outside them — inline in the code as its own reason, in the user
   story, in a `.claude/rules/` convention, or in the Memory Bank? Anything still
   living only in the spec or the plan gets captured now. This check was already made
   while the spec was written (see "Spec → PR before implementation"), so here it
   normally only confirms.
2. **Then delete.** `git rm` the story's spec and plan — superpowers writes them to
   `docs/superpowers/specs/` and `docs/superpowers/plans/` — and commit the deletion
   into the branch of the **implementation PR** under review. Never into a spec PR's
   branch; if the PR you are in changes no production code, it is the wrong one.
3. **Never** delete Memory Bank records or conventions along with them. Those are the
   durable trace and stay.
