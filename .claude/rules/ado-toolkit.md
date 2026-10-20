---
paths:
  - "plugins/ado-toolkit/**"
---

# ado-toolkit

Azure DevOps Server through the `az` CLI, for every team — also teams that do not follow SDD or
mostly work on tickets. `sdd-kit` depends on it.

- **Process-neutral.** No specs, 📝 markers or Memory Bank here. A calling skill layers its own
  conventions on top: `/ado-pr`'s PR Creation step 7 lets it prescribe marker and description
  structure (that is how `sdd-kit:spec-pr` gets its spec PRs).
- **A git checkout is the prerequisite**, also for ticket-only work: its `origin` picks server,
  collection and project, and the checkout is what many actions work from. There is
  deliberately no mode that asks for organization and project instead.
- **`skills/ado-shared/REFERENCE.md` is the single place** for connection detection, sign-in
  check, command map, title schema, quirks, German text, line breaks and voice. The three
  `SKILL.md` files link to it by relative path; do not repeat its content in them.
- **Never authenticate.** The skills only confirm an existing `az devops login` with a
  read-only call and stop with instructions otherwise.
- **Server facts are verified, not assumed.** German types, states and relation names
  (`"Übergeordnetes Element"`, not `parent`), HTML in every work item field and comment, a
  Fehler's content in `Microsoft.VSTS.TCM.ReproSteps`, the comments API only as `7.1-preview`,
  `--assigned-to` by display name. Before changing one of these, check it against the server
  with a read-only `az` call.
- **Area and Iteration go onto the team node; the team is asked or known from the context**
  (conversation, the repo's `CLAUDE.md` / `.claude/rules/`), never inferred from parent or
  siblings.
- **Text sent to ADO is never hard-wrapped** — PR Markdown turns a newline into a line break,
  work item HTML ignores it. The 100-character rule applies to the repo's files only.
