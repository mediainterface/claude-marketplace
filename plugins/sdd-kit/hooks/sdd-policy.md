# Project SDD policy

This project follows a Spec-Driven-Development (SDD) workflow. The rules below are
**project-level instructions and OVERRIDE the superpowers skills where they
conflict** — project/user instructions take precedence over skills.

## Spec → PR before implementation

Once the superpowers `brainstorming` skill has produced a design spec and the user
has approved it, do **not** invoke the `writing-plans` skill and do **not** write an
implementation plan or any code. Instead, invoke the `sdd-kit:spec-pr` skill, which
opens a pull request for the spec (plus any Memory Bank items) and then stops until
the PR is merged.

The implementation plan (`writing-plans`) happens only **after** the spec PR is
merged, as a separate later effort. Proceed to `writing-plans` now **only** if the
user explicitly asks for an implementation plan in this session.

## Implementation: plan steps → Azure DevOps tasks

This part applies during implementation — after the spec PR has merged, when the
plan is actually written and executed.

When an implementation plan is created for a spec **and a user story is referenced**
(an existing Azure DevOps user story, mentioned by ID):

- **After the plan is written and approved, confirm before creating anything.**
  Fetch the referenced user story and show the user its **ID and title** — so a
  wrong work item is caught before any tasks are created — together with the list of
  tasks you would create from the plan's todo list, and **explicitly ask whether to
  create them**. Proceed only on an explicit yes; if the user declines or names a
  different story, adjust or skip accordingly.
- **On confirmation**, create one Azure DevOps **task** (*Aufgabe*) for each item on
  the plan's todo list using the `sdd-kit:ado-workitem` skill, each as a **child of
  that user story** (parent link + `#<id>` in the title). Titles and descriptions
  follow that skill's conventions — human-readable **German**, built from the shared
  title schema (`User Story #<id> <Component/Application> - <Beschreibung>`), with
  type and state names fetched from the server (never assumed).
- **During implementation, drive each task through its lifecycle** via
  `ado-workitem`, mirroring the plan step it represents: when you start working on
  the step, set its task to the server's *active* state (e.g. *Aktiv*); when the step
  is complete, set it to the server's *closed* state (e.g. *Geschlossen*). Fetch the
  exact localized state names from the server rather than guessing.

If no user story is referenced, implement the plan normally (skip this part).
