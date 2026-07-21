---
name: spec-pr
description: >-
  Opens a pull request for a just-written Spec-Driven-Development spec (plus any
  Memory Bank items) and then STOPS — no implementation plan, no code — until the PR
  is merged. Use immediately after the superpowers brainstorming skill produces a
  spec and the user approves it, INSTEAD of writing-plans. Auto-detects the git
  remote: Azure DevOps → the ado-pr workflow, GitHub → the gh CLI. Also triggers on
  "PR the spec", "open a spec PR", or "ship the spec for review".
argument-hint: (run after a spec is written & approved; no arguments needed)
allowed-tools: Bash, Read, Glob, Grep, Skill
---

# Spec → Pull Request (SDD gate)

In MediaInterface's Spec-Driven-Development flow, a spec is reviewed and **merged as
its own pull request before any implementation planning or coding happens**. This
skill takes the spec the superpowers `brainstorming` skill just wrote, opens a PR for
it (together with any Memory Bank items), and then **stops**. It deliberately does
**not** invoke `writing-plans`, does not write an implementation plan, and does not
write code — getting the spec merged, and any later implementation, are separate
efforts.

> **This skill is the SDD replacement for brainstorming's `writing-plans` handoff.**
> A SessionStart hook in this plugin injects the policy that routes here; you can
> also invoke it manually at any time.

## When NOT to use it

If the user **explicitly** asks for an implementation plan or to start coding, do
that instead — this gate is the default next step after a spec, not a hard lock.

## Workflow

### Step 1: Locate the spec

Find the design spec the flow just produced:

```bash
ls -t docs/superpowers/specs/*-design.md 2>/dev/null | head -5
```

Use the most recent one. If several are plausible, ask the user which to PR. If none
exists, say so and stop — there is nothing to open a PR for.

### Step 2: Restate the scope (once)

Tell the user briefly: this opens a PR for `<spec path>` and then stops — **no
implementation plan and no code** will be written now. Proceed unless they object.

### Step 3: Offer to capture Memory Bank items

Ask whether any decisions or lessons from the brainstorm should be recorded so they
ride in the **same** PR as the spec:

- Design decisions → invoke the `create-decision` skill (one record per decision).
- Recurring patterns / pitfalls → invoke the `create-lesson-learned` skill.

Skip if the user declines. (`create-decision` already notes that a decision ships
together with the spec, so bundling them here is intentional.)

### Step 4: Put the work on a branch

A spec PR needs a source branch that is not the default branch.

```bash
current=$(git branch --show-current)
default=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
```

- If `current` is already a dedicated branch (not `default`), stay on it.
- If `current` **is** the default branch, move to a new branch **before committing**,
  so nothing lands on the default. Create and switch to it — this carries the spec
  (committed or not) onto the new branch:

  ```bash
  git checkout -b "spec/<topic>"
  ```

  If the spec had **already been committed** to the default branch and those commits
  are **not yet pushed**, also reset the local default pointer back so it stays clean
  (safe — `git branch -f` touches neither the working tree nor the new branch):

  ```bash
  git branch -f "$default" "origin/$default"
  ```

  If those commits were **already pushed** to the default branch, do NOT rewrite
  history — tell the user and ask how to proceed.

Derive `<topic>` from the spec filename (the segment between the date and
`-design.md`). If `default` cannot be detected, ask the user for the target branch.

### Step 5: Commit anything uncommitted

The brainstorming skill usually already committed the spec. Stage the spec and any
Memory Bank files and commit only if something is still pending. Memory Bank
records can live on a nested level (`apps/<app>/docs/…`, `services/<service>/docs/…`
— see [../memory-bank-shared/REFERENCE.md](../memory-bank-shared/REFERENCE.md)), so
`git add docs/` alone would silently miss them: stage every file Step 3 created by
its explicit path (`git add` errors on a pathspec that matches nothing, so add the
paths you know rather than globbing).

```bash
git add docs/ <each Memory Bank file from Step 3, by explicit path>
git diff --cached --quiet || git commit -m "📝 Spec: <topic>"
```

If Step 3 created nothing, plain `git add docs/` is sufficient.

### Step 6: Detect the remote and open the PR

```bash
git remote get-url origin
```

- **Azure DevOps remote** (a `…/_git/…` URL, or `dev.azure.com` / `*.visualstudio.com`):
  follow the **PR Creation** workflow in the `ado-pr` skill
  ([../ado-pr/SKILL.md](../ado-pr/SKILL.md)) — complete **Step 0** and the **Setup
  Check** in [../ado-shared/REFERENCE.md](../ado-shared/REFERENCE.md) first. Follow
  the shared **Title schema** with the **📝 spec-only** marker (see the "Title schema
  (PRs & work items)" section in the reference). A linked **work item is required** —
  ADO mandates one for every PR — so `ado-pr` asks for it and links it (and it appears
  as `#<ID>` in the title); if the spec has no associated work item yet, ask the user
  which one to link before creating the PR. Push the branch, create the PR, and note the
  `pullRequestId`.
- **GitHub remote** (`github.com`): push and open the PR with the `gh` CLI, reusing
  the **📝 spec-only** marker:

  ```bash
  git push -u origin "$(git branch --show-current)"
  gh pr create --title "📝 <Component> - <short summary>" \
    --body "$(printf 'Spec for review before implementation.\n\nSpec: %s\n' "<spec path>")"
  ```

- **Neither:** tell the user the remote is not recognised and ask how they want the
  PR created.

### Step 7: Stop and hand off

Report the PR URL and ID, then **stop**. State explicitly:

- The spec is now up for review and must be **merged** before implementation begins.
- No implementation plan and no code were written — by design.
- Do **not** invoke `writing-plans`. Implementation is a separate, later effort
  (e.g. driven from work items via the `ado-*` skills) once the spec is merged.

## Important

- This skill never writes an implementation plan or code. Its terminal state is an
  **open PR for the spec**.
- It authenticates nothing itself: for the Azure DevOps path it assumes the user is
  already signed in (see the shared reference); for GitHub it assumes `gh` is set up.
- One PR carries the spec **and** its Memory Bank items together, so reviewers see
  the decisions and lessons alongside the spec they justify.
