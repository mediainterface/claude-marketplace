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
