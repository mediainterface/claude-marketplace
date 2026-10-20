# SDD pull requests — shared reference

Shared definitions for the pull requests of the SDD workflow, used by
[spec-pr](../spec-pr/SKILL.md) (which *creates* a spec PR) and
[pr-review](../pr-review/SKILL.md) (which determines the kind of an *existing* PR). This file is
**not** a skill — the skills link here so the definition exists exactly once.

The Azure DevOps side itself — connection detection, sign-in check, title schema, command map,
quirks — lives in the `ado-toolkit` plugin, which `sdd-kit` depends on. That plugin knows no spec
PRs: its PR-creation workflow (`ado-toolkit:ado-pr`) lets a calling skill prescribe the marker
and the description structure, and the conventions below are what the SDD skills prescribe.

## Spec PR vs. implementation PR

On the SDD workflow's normal path a story's spec gets its own pull request and is merged before
the implementation starts, so most PRs are plainly one kind or the other — and `pr-review`
reviews the two very differently (a spec has no tests, no production code, and no drift;
measuring it against the code dimensions finds nothing and costs a full run). `spec-pr` creates
the one kind on purpose, `pr-review` determines the kind of an **existing** PR. This section is
the single definition both use.

**A mixed PR is not a rule violation.** Small changes — a bug fix, a contained adjustment —
legitimately carry their spec or documentation update next to the code; splitting those in two
costs more overhead than a separate spec review is worth. What the workflow's own spec PR buys is
feedback **before** the implementation exists, and that is only worth having when there is a
substantial implementation left to steer. So a mixed diff is classified, not indicted.

**Two signals:**

- **The changed-file set** — a PR is spec-only when **every** changed file is documentation:
  `*.md`, or anything under a `docs/` directory on **any** level (root `docs/`, nested
  `apps/<app>/docs/`, `services/<service>/docs/`, including their `decisions/` and
  `learnings/`). A single changed source file makes it an implementation PR.
- **The title marker** — a leading 📝 (see **Spec PR conventions** below) records that the PR
  was *created* as a spec PR.

**The changed-file set decides; the marker only corroborates.** The marker states an intention
at creation time, the diff is what the PR actually became — and per the **Quirks** in
`ado-toolkit`'s shared reference the CLI may return a title with the emoji stripped, so a missing
📝 in JSON is not evidence of anything. Never let an absent marker outvote a documentation-only
diff.

| Changed files | Kind |
|---|---|
| documentation only | **Spec PR** — with or without the 📝. A missing marker means the emoji was stripped from the JSON or the PR was not created through `spec-pr`; neither is a reason to doubt the diff. |
| documentation **and** source code | **Implementation PR** — the ordinary shape of a small change that brings its doc update along. Review the code with the code dimensions and the doc part alongside it. |
| source code only | **Implementation PR.** |

A **📝 in the title of a PR that changes source code** is worth one line to the author — the
title no longer describes the PR and reviewers read the marker as "no code here" — but it is a
title to correct, not a breach to report.

**Reviewing needs no confirmation.** When *reviewing* an existing PR there is nothing left to
confirm — the diff already decided. Classify, proceed, and state the kind plus the signal that
proves it in the report instead of asking.

## Spec PR conventions

What `spec-pr` prescribes when it runs `ado-toolkit:ado-pr`'s **PR Creation** workflow. They
replace that workflow's marker vote and default description; the rest of it — pushed branch,
required and linked work item, the review before creating — stays as written there.

- **Marker 📝** instead of the change-category vote. Title:
  `📝 #<WorkItemId> <Component> - <Beschreibung>`.
- **Component** — a spec PR has no code paths, so derive it from the spec subject; **if it
  cannot be determined, ask the user.**
- **Description (German)** — the repo's PR template if there is one, otherwise:
  - **Inhalt** — short German summary of the spec. No document list, no commit list.
  - **Erwartetes Umsetzungsrisiko** (in place of **Risikobewertung**) — the risk of the
    **implementation the spec describes**: its scope, complexity, and impact, *not* the risk of
    merging the spec document, which would be pointless. So do **not** default to `Niedrig`;
    judge `Niedrig`/`Mittel`/`Hoch` from what the spec proposes and justify it after `weil`.
  - **No Betroffene Komponenten** — there is no code change yet.

  A repo template without a risk section gets **Erwartetes Umsetzungsrisiko** appended.
- **The work item is still linked** to the PR, as on every ADO PR — only the description body
  differs, the link does not.

**Updating a spec PR** (through `ado-toolkit:ado-pr`'s **PR Update** workflow) keeps the 📝 and
this description structure.
