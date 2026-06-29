---
name: ado-pipeline
description: >-
  Azure DevOps pipelines and changelogs via the Azure CLI (az + azure-devops extension) —
  analyse a build/pipeline failure (timeline, failed-task logs, root cause, suggested fix)
  and generate a changelog of what changed since a build or commit. Use when the user pastes
  a pipeline/build URL or a build ID, asks about a build failure, or asks what changed since
  a build or commit. Newest Azure DevOps Server; assumes you are already signed in (PAT).
argument-hint: <PIPELINE_URL_OR_BUILD_ID | changelog>
allowed-tools: Bash, Read, Glob, Grep
---

# Azure DevOps — Pipelines & Changelog (CLI)

Build/pipeline workflows for Azure DevOps via the Azure CLI (`az` + `azure-devops`
extension): **pipeline failure analysis** and **changelog since a build or commit**. Use this
skill when the user pastes a pipeline/build URL or build ID, asks why a build failed, or asks
what changed since a build/commit.

> **Shared setup first.** Before any `az` command, complete **Step 0 (connection detection)**
> and the **Setup Check (sign-in confirmation)** in
> [../ado-shared/REFERENCE.md](../ado-shared/REFERENCE.md). That file also holds the
> **Command Map**, **Repository Mismatch Check**, **Quirks**, and **Error handling &
> local-state safety** rules the workflows below refer to. `{org}` = `organization`,
> `{repo}` = `repository`, `{project}` come from Step 0.

---

## Workflow: Pipeline Analysis

**Trigger:** User provides a pipeline URL (containing `/_build/results?buildId=`) or a numeric build ID, or asks about a build failure.

1. **Parse input:** Extract `buildId` from the URL query parameter, or use the numeric ID directly.
2. **Fetch build metadata:** `az pipelines build show --id {buildId} --org {org} --project {project} --detect false -o json`. Note `definition.id` (for step 7), `sourceBranch`, `sourceVersion`, `requestedFor`, `startTime`, `finishTime`, `result`, `repository.name`.
   **Repository check:** compare `repository.name` against the local `repository` from Step 0; if they differ, run the Repository Mismatch Check and stop unless confirmed.
3. **Fetch timeline:** `az devops invoke --area build --resource Timeline --route-parameters project={project} buildId={buildId} --org {org} --api-version 7.1 -o json`. From `records`, find entries where `result` is `"failed"` and `type` is `"Task"`. Note their `log.id` and any `issues[]`.
4. **Fetch logs for each failed task:** `az devops invoke --area build --resource logs --route-parameters project={project} buildId={buildId} logId={logId} --org {org} --api-version 7.1 -o json`. Join the returned `value` array into text. Extract error lines matching `##[error]`, `error:`, `error `, `FAILED`, `fatal:`, `fatal `, `exception:`, `exception ` (case-insensitive). Focus analysis on those lines rather than dumping full logs.
5. **Fetch associated commits:** `az devops invoke --area build --resource Changes --route-parameters project={project} buildId={buildId} --org {org} --api-version 7.1 -o json`.
6. **Checkout the build's source branch** so local files match what the build ran against
   (the restore in step 9 MUST run even if a later step fails — see "Error handling &
   local-state safety" in the shared reference):
   - Record the current branch (or commit if detached) as `originalRef`: `git branch --show-current` / `git rev-parse HEAD`. Remember whether you stash below.
   - Stash uncommitted changes if any: `git stash -u`.
   - Strip `refs/heads/` from `sourceBranch`, then: `git fetch origin {sourceBranch} && git checkout origin/{sourceBranch} --detach`.
   - If the branch no longer exists, use `sourceVersion` instead: `git fetch origin {sourceVersion} && git checkout {sourceVersion} --detach`.
7. **Fetch pipeline definition:** `az pipelines build definition show --id {definitionId} --org {org} --project {project} --detect false -o json`. If `process.yamlFilename` is present, read that YAML from the local repo and follow `template:` references.
8. **Analyse and report:** Error summary (what failed + one-sentence root cause); detailed analysis connecting error logs to pipeline steps and source; root cause (symptom vs cause, responsible commit if any); suggested fix (concrete changes); prevention. Common categories: build, test, deployment, infrastructure, configuration, dependency.
9. **Restore local state (always — on success, error, or interruption):** `git checkout {originalRef}`; if you stashed, `git stash pop`. If any step from 6 onward fails, do this **first**, then report the error and stop.

---

## Workflow: Changelog

**Trigger:** User asks what changed since a build or commit, or `$ARGUMENTS` starts with `changelog`.

### Input Resolution
Determine the **base commit SHA**:
1. **Build URL** — extract `buildId` from `/_build/results?buildId=`, then proceed as build ID.
2. **Build ID** (numeric) — `az pipelines build show --id {buildId} --org {org} --project {project} --detect false -o json`; use `sourceVersion` as the commit SHA.
   **Repository check:** compare `repository.name` against local `repository`; if different, run the Repository Mismatch Check and stop unless confirmed.
3. **Commit SHA** (hex, 7–40 chars) — use directly.

### Steps
1. **Repository name:** use `repository` from Step 0.
2. **Get default branch:** `az repos show --repository {repo} --org {org} --project {project} --detect false -o json`; use `defaultBranch` (strip `refs/heads/`).
3. **Fetch latest:** `git fetch origin {defaultBranch}`.
4. **Ensure base commit is local:** `git cat-file -t {commit}`; if it fails, `git fetch origin {commit}`; if still failing, report "Commit {commit} not found locally or on the remote." and stop.
5. **Check for changes:** `git rev-list --count {commit}..origin/{defaultBranch}`; if `0`, report "Default branch is at the same commit as the build — no new changes." and stop.
6. **Commit log:** `git log --format='%h %an <%ae> %s' {commit}..origin/{defaultBranch}`.
7. **File stats:** `git diff --stat {commit}..origin/{defaultBranch}`.
8. **Full diff:** `git diff {commit}..origin/{defaultBranch}`.

### Output
1. **Commit Log** — all commits between base and `origin/{defaultBranch}` (short SHA, author, message).
2. **File Overview** — `git diff --stat` grouped by top-level dir/component; totals (files, insertions, deletions).
3. **Narrative Summary** — prose describing features added, bugs fixed, refactors, as a briefing for the next build.
