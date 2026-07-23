# Project SDD policy

This policy describes MediaInterface's Spec-Driven-Development (SDD) workflow. The
rules below are **project-level instructions and OVERRIDE the superpowers skills
where they conflict** — project/user instructions take precedence over skills.

## Does this policy apply here?

The SDD workflow is for MediaInterface repos. When the policy first becomes
relevant in a session — e.g. a spec has just been approved, or ADO tasks are about
to be created — check the project's git origin (`git remote get-url origin`) if you
do not already know it:

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

## Implementation: plan steps → Azure DevOps tasks

This part applies during implementation — after the spec PR has merged, when the
plan is actually written and executed.

When an implementation plan is created for a spec **and a user story is referenced**
(an existing Azure DevOps user story, mentioned by ID):

- **Check the user story's state first.** During implementation it should be in the
  **Implementation** state; if it is not, **point this out to the user** so they can
  correct it — do not change the story's state yourself (you manage the *tasks'*
  states, not the story's).
- **After the plan is written and approved, confirm before creating anything.**
  Fetch the referenced user story and show the user its **ID and title** — so a wrong
  work item is caught before any tasks are created — the list of tasks you would
  create from the plan's todo list, and the **Area/Iteration paths** the tasks will
  inherit (the user story's own paths). **Explicitly ask whether to create them, and
  let the user adjust the paths.** Proceed only on an explicit yes; if the user
  declines or names a different story, adjust or skip accordingly.
- **On confirmation**, create one Azure DevOps **task** (*Aufgabe*) for each item on
  the plan's todo list using the `sdd-kit:ado-workitem` skill, each as a **child of
  that user story** (parent relation). Set each task's **Area Path and Iteration Path
  to the referenced user story's own paths** — read them from the user story — unless
  the user adjusted them at the confirmation step. Titles and descriptions follow that
  skill's conventions — human-readable **German**, the title being just the concise
  description (per the shared title schema), with type and state names fetched from the
  server (never assumed).
- **During implementation, drive each task through its lifecycle** via `ado-workitem`,
  mirroring the plan step it represents: when you start working on the step, set its
  task to the server's *active* state (e.g. *Aktiv*); when the step is complete, set
  it to the server's *closed* state (e.g. *Geschlossen*). Fetch the exact localized
  state names from the server rather than guessing.
- **When the whole user story is finished** (all its tasks are closed), **reset the
  Area Path and Iteration Path of the tasks you created** back to the project root
  (the project name — the first segment of the path, no team), via `ado-workitem`.
  Leave the user story itself untouched.

If no user story is referenced, implement the plan normally (skip this part).
