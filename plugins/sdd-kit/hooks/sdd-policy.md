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
one-off local design choice stays in the spec or PR.

A criterion counts only with **named evidence** — which existing pattern
changes, the second place that exists **today**, the concrete
features/apps/teams, what a revert costs — and you name it to the user when
you affirm it. Even with a criterion ticked, behavior that sits at one spot,
in one feature, and is cheap to revert gets a **comment at the code**, not a
record. This applies where the record is first proposed, a spec's *Memory
Bank* section included.

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
