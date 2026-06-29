---
name: ado-cli
description: >-
  Work with Azure DevOps via the Azure CLI (az + azure-devops extension) — analyse
  pipeline failures, review pull requests, create/update/comment on pull requests, manage
  work items (German-localized types, e.g. Aufgabe/Fehler), and generate changelogs since a
  given build or commit. This is the CLI variant of the azure-devops skill, for the
  newest Azure DevOps Server version, authenticated with a Personal Access Token (PAT).
  Use when the user mentions ADO pipelines, builds, PRs, work items / Arbeitselemente /
  Aufgaben, changelogs, or pastes Azure DevOps URLs, or when the user asks to use the az
  CLI for Azure DevOps.
argument-hint: <PIPELINE_URL_OR_BUILD_ID | PR_ID_OR_URL | create | update | comment [add|reply|resolve] | changelog | workitem [create|show|update]>
allowed-tools: Bash, Read, Glob, Grep
---

# Azure DevOps CLI Skill

This skill mirrors the `azure-devops` skill but talks to the server through the
Azure CLI (`az`) with the `azure-devops` extension instead of REST/MCP. Use it for the
**newest** Azure DevOps **Server** version; the MCP-based `azure-devops` skill remains the
right choice for the older Server version.

> **German-localized Server.** Our Azure DevOps is German, so its work item types and
> states are German (e.g. `Aufgabe`, not `Task`) — the workflows below fetch them from the
> server rather than assuming English names. The skill assumes you are **already signed in**
> to Azure DevOps and never authenticates for you — the Setup Check confirms it and, if not,
> shows you how.

## Step 0: Detect ADO Connection

1. Run `git remote get-url origin` via Bash.
2. Parse the remote URL into `organization` (a full URL), `project`, and `repository`.
   Recognise these forms:
   - **HTTPS:** `https://{host}[:port]/{collection}/{project}/_git/{repo}`
     → `organization = https://{host}[:port]/{collection}`
   - **SSH:** `ssh://{host}[:port]/{collection}/{project}/_git/{repo}` or
     `{user}@{host}:{collection}/{project}/_git/{repo}` → take `{collection}`, `{project}`,
     and `{repo}` from the path and build `organization = https://{host}/{collection}`
     (confirm the HTTPS base with the user if the host/port is ambiguous).
3. If the URL matches no Azure DevOps form, tell the user this skill only works with
   Azure DevOps repositories and stop.
4. Set CLI defaults so later commands are terse:
   ```bash
   az devops configure --defaults organization={organization} project={project}
   ```
   Still pass `--org {organization}` (plus `--project {project} --detect false` where
   the command accepts them) explicitly on the commands below — defaults are a
   convenience, explicit args are the contract. Note: `az repos pr show` and
   `az repos pr update` take only `--id` and `--org` (a PR ID is org-unique), so they
   do not get `--project`.
5. Store `organization`, `project`, `repository`. Use them for ALL subsequent `az` calls.

Then run the **Setup Check** below once before any other `az` command.

## Setup Check (run once)

Verify the toolchain before doing real work. On any failure, give the exact fix and **stop**.

1. **Azure CLI present:**
   ```bash
   az version
   ```
   If `az` is not found:
   > **Azure CLI is not installed.** Install it, then re-run.
   > - macOS: `brew install azure-cli`
   > - Windows: `winget install -e --id Microsoft.AzureCLI`
   > - Linux / other: https://learn.microsoft.com/cli/azure/install-azure-cli

2. **azure-devops extension present:**
   ```bash
   az extension show --name azure-devops
   ```
   If missing:
   ```bash
   az extension add --name azure-devops
   ```

3. **Authenticated:** Assume the user has **already** signed the Azure CLI in to Azure
   DevOps. Do **not** authenticate on their behalf — never run `az devops login`, set auth
   environment variables, or read a PAT from the environment yourself. Only **confirm** their
   existing sign-in with a read-only call (covered by the Code scope below):
   ```bash
   az repos show --repository {repository} --org {organization} --project {project} --detect false -o json
   ```
   If this returns an authentication/authorization error (HTTP 401/403) or reports the user
   is not signed in, **stop**, show them the **authentication instructions** below, and
   wait — do not start any work until they confirm they have signed in.

### Authentication instructions (show these to the user; do not act on them yourself)

> **You are not signed in to Azure DevOps in the Azure CLI.** Please sign in yourself, then
> tell me to continue.
>
> **1. Create a Personal Access Token (PAT):**
> 1. Open your Azure DevOps Server in the browser.
> 2. Profile picture (top right) → **Security** → **Personal access tokens**.
> 3. Click **+ New Token**, give it a descriptive name (e.g. `claude-code`), set an expiration.
> 4. Select the scopes the skill's workflows need:
>    - **Code** — Read & write (PR review/create/update, repository and changelog access)
>    - **Build** — Read (pipeline analysis)
>    - **Work Items** — Read & write (work item create/show/query/update)
> 5. Click **Create** and copy the token.
>
> **2. Sign in with the PAT:**
> ```bash
> az devops login --org {organization}
> ```
> Paste the PAT when prompted.
>
> (You can reuse the same PAT as the MCP-based `azure-devops` skill.)

After giving any Setup Check instruction (steps 1–3), **stop** — run no further `az`
commands and do no work until it is resolved; for sign-in, until the user confirms.

## Quirks — expected false signals (do NOT treat as errors)

The Azure CLI produces two misleading outputs that are safe to ignore. In both cases,
**proceed as if the operation succeeded**; the user will call it out if something
genuinely failed.

1. **Emoji stripped from the return value.** When a PR or work item title/description
   contains an emoji, the CLI may print JSON with the emoji missing even though the resource
   actually has it — **verified present in the web UI**. This has been observed as a
   **Windows console-encoding (cp1252) artifact**; the echo/input behaviour may differ on
   macOS/Linux, so **verify once per platform** rather than treating it as a universal
   guarantee. Once confirmed for your platform, do **not** retry, "fix", or warn about a
   missing emoji in the returned JSON — check the web UI if unsure.

2. **False compatibility warning.** The CLI may print a warning that it is not
   compatible with this Azure DevOps Server version. This is a **false positive** — the
   CLI has been fully tested against our server and every workflow in this skill works.
   Ignore the warning and continue.

## Command Map (REST endpoint → az command)

`{org}` = `organization`, `{project}`, `{repo}` = `repository` from Step 0. Request JSON
with `-o json`. For endpoints without a first-class command, use `az devops invoke`
(it authenticates the same way). If an `invoke` `--resource` name is ever rejected,
discover the correct one with `az devops invoke --query "[?area=='build']"` (or
`'git'`) and match the `routeTemplate`.

| Purpose | Command |
|---|---|
| Build metadata | `az pipelines build show --id {buildId} --org {org} --project {project} --detect false -o json` |
| Build timeline | `az devops invoke --area build --resource Timeline --route-parameters project={project} buildId={buildId} --org {org} --api-version 7.1 -o json` |
| Task log | `az devops invoke --area build --resource logs --route-parameters project={project} buildId={buildId} logId={logId} --org {org} --api-version 7.1 -o json` |
| Build changes (commits) | `az devops invoke --area build --resource Changes --route-parameters project={project} buildId={buildId} --org {org} --api-version 7.1 -o json` |
| Pipeline definition | `az pipelines build definition show --id {definitionId} --org {org} --project {project} --detect false -o json` |
| Repository metadata | `az repos show --repository {repo} --org {org} --project {project} --detect false -o json` |
| PR metadata | `az repos pr show --id {prId} --org {org} -o json` |
| Create PR | `az repos pr create --repository {repo} --source-branch {source} --target-branch {target} --title "{title}" --description "{description}" --org {org} --project {project} --detect false -o json` |
| Update PR | `az repos pr update --id {prId} [--title "{title}"] [--description "{description}"] [--status active\|abandoned\|completed] --org {org} -o json` |
| List active PRs by source branch | `az repos pr list --repository {repo} --source-branch {branch} --status active --org {org} --project {project} --detect false -o json` |
| PR comment threads (list) | `az devops invoke --area git --resource pullRequestThreads --route-parameters project={project} repositoryId={repo} pullRequestId={prId} --org {org} --api-version 7.1 -o json` |
| Add PR comment thread | `az devops invoke --area git --resource pullRequestThreads --route-parameters project={project} repositoryId={repo} pullRequestId={prId} --http-method POST --in-file {body.json} --media-type application/json --org {org} --api-version 7.1 -o json` |
| Reply to a PR thread | `az devops invoke --area git --resource pullRequestThreadComments --route-parameters project={project} repositoryId={repo} pullRequestId={prId} threadId={threadId} --http-method POST --in-file {body.json} --media-type application/json --org {org} --api-version 7.1 -o json` |
| Resolve/reopen a PR thread | `az devops invoke --area git --resource pullRequestThreads --route-parameters project={project} repositoryId={repo} pullRequestId={prId} threadId={threadId} --http-method PATCH --in-file {body.json} --media-type application/json --org {org} --api-version 7.1 -o json` |
| Link / list / unlink PR work items | `az repos pr work-item add\|list\|remove --id {prId} [--work-items {id}] --org {org} -o json` |
| Work item **types** (localized names) | `az devops invoke --area wit --resource workItemTypes --route-parameters project={project} --org {org} --api-version 7.1 -o json` |
| Work item type **states** (localized) | `az devops invoke --area wit --resource workItemTypeStates --route-parameters project={project} type={typeName} --org {org} --api-version 7.1 -o json` |
| Show work item | `az boards work-item show --id {id} --org {org} -o json` |
| Create work item | `az boards work-item create --title "{title}" --type "{germanTypeName}" [--description "{description}"] [--assigned-to "{user}"] --org {org} --project {project} -o json` |
| Update work item | `az boards work-item update --id {id} [--title "{title}"] [--state "{germanState}"] [--assigned-to "{user}"] --org {org} -o json` |
| Link work item to parent | `az boards work-item relation add --id {childId} --relation-type parent --target-id {parentId} --org {org} -o json` |
| Query work items (WIQL) | `az boards query --wiql "{wiql}" --org {org} --project {project} -o json` |

**CLI-vs-REST differences to remember:**
- `--source-branch` / `--target-branch` take the **bare** branch name (`feature/x`), NOT
  `refs/heads/feature/x`. Always strip the `refs/heads/` prefix before passing.
- `az repos show` returns `defaultBranch` as `refs/heads/{name}` — strip the prefix for
  local git operations, same as the REST skill.
- The task-log `invoke` returns a JSON object with a `value` array of log lines; join
  that array to reconstruct the plain-text log.
- **German installation:** work item **type** names (`Aufgabe`, not `Task`) and **state**
  names (`Aktiv`, not `Active`) are localized. `--type` / `--state` and WIQL *values* take
  these German names — fetch them from the server (see the Work Item Management workflow)
  rather than assuming. WIQL *field reference names* (`System.WorkItemType`, `System.State`)
  stay invariant English.

## Repository Mismatch Check

When the user provides a URL or build ID, the referenced resource may belong to a
different repository than the one you are in. After fetching metadata, compare the
repository name in the response against the local `repository` from Step 0. If they
differ, warn before proceeding:
> "The build/PR belongs to repository **{remote repo}**, but you are currently in
> **{local repo}**. Local git operations (reading pipeline YAML, checking out branches,
> generating diffs) will use the wrong codebase. Do you want to continue anyway?"

Only proceed if the user explicitly confirms.

## Error handling & local-state safety

Some workflows check out a branch/commit and stash the user's uncommitted work. Treat the
**checkout and its restore as a try/finally**: before checking out, record the current
branch (or commit, if detached) as `originalRef` and whether you stashed; then guarantee the
restore runs **whether the workflow succeeds, errors, or is interrupted** — never leave the
user in a detached HEAD with their changes still stashed.

On any `az`/`git` failure or interruption:
1. **Restore local git state first** — `git checkout {originalRef}`, then `git stash pop` if
   you stashed — before doing anything else.
2. **Report, don't paper over** — show the exact command that failed and its error output,
   then **stop**. Do not silently retry, guess, or fall back to another transport (e.g.
   API-based changes).
3. **Auth errors (HTTP 401/403):** stop and follow the Setup Check sign-in instructions.

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
   local-state safety"):
   - Record the current branch (or commit if detached) as `originalRef`: `git branch --show-current` / `git rev-parse HEAD`. Remember whether you stash below.
   - Stash uncommitted changes if any: `git stash -u`.
   - Strip `refs/heads/` from `sourceBranch`, then: `git fetch origin {sourceBranch} && git checkout origin/{sourceBranch} --detach`.
   - If the branch no longer exists, use `sourceVersion` instead: `git fetch origin {sourceVersion} && git checkout {sourceVersion} --detach`.
7. **Fetch pipeline definition:** `az pipelines build definition show --id {definitionId} --org {org} --project {project} --detect false -o json`. If `process.yamlFilename` is present, read that YAML from the local repo and follow `template:` references.
8. **Analyse and report:** Error summary (what failed + one-sentence root cause); detailed analysis connecting error logs to pipeline steps and source; root cause (symptom vs cause, responsible commit if any); suggested fix (concrete changes); prevention. Common categories: build, test, deployment, infrastructure, configuration, dependency.
9. **Restore local state (always — on success, error, or interruption):** `git checkout {originalRef}`; if you stashed, `git stash pop`. If any step from 6 onward fails, do this **first**, then report the error and stop.

---

## Workflow: PR Review

**Trigger:** User provides a PR ID (numeric) or PR URL, or asks to review a PR.

1. **Parse input:** Extract PR ID from the URL path or use the numeric ID directly.
2. **Fetch PR metadata:** `az repos pr show --id {prId} --org {org} -o json`. Note `sourceRefName`, `targetRefName`, `title`, `description`, `createdBy`, `creationDate`, `status`, `repository.name`.
   **Repository check:** compare `repository.name` against the local `repository`; if different, run the Repository Mismatch Check and stop unless confirmed.
3. **Generate local git diffs:** strip `refs/heads/` from source and target, then:
   ```bash
   git fetch origin {sourceBranch} {targetBranch}
   git diff --name-status origin/{targetBranch}...origin/{sourceBranch}
   git diff --stat origin/{targetBranch}...origin/{sourceBranch}
   git diff origin/{targetBranch}...origin/{sourceBranch}
   git log --oneline origin/{targetBranch}...origin/{sourceBranch}
   ```
   **If the source branch no longer exists** (merged/deleted, `git fetch` fails): use `lastMergeSourceCommit.commitId` from the PR metadata — `git fetch origin {commitId}`, then diff against `{commitId}` instead of `origin/{sourceBranch}`.
   **If git operations fail for any other reason, report the error and stop.** Do NOT fall back to API-based changes.
4. **Fetch PR comment threads:** `az devops invoke --area git --resource pullRequestThreads --route-parameters project={project} repositoryId={repo} pullRequestId={prId} --org {org} --api-version 7.1 -o json`. Filter out system-only threads (every comment has `commentType: "system"`); show human comments.
5. **Checkout the source branch** to explore the PR state (the restore in step 8 MUST run
   even if a later step fails — see "Error handling & local-state safety"):
   - Record the current branch (or commit if detached) as `originalRef`. Remember whether you stash below.
   - Stash uncommitted changes if any: `git stash -u`.
   - `git checkout origin/{sourceBranch} --detach` (or `{commitId} --detach` if the deleted-branch fallback was used in step 3).
6. **Gather context:** read CLAUDE.md files in/near affected dirs; read related files the change imports/extends; use Glob/Grep for conventions.
7. **Review** covering: Summary, Code Quality, Correctness, Security (injection/XSS/secrets/OWASP), Performance (N+1, inefficiencies), Architecture (project patterns), Testing. Reference file paths and line numbers; distinguish blockers from suggestions. **This review is read-only** — it produces the written review for the user; to post comments or resolve threads on the PR, use the **PR Comments** workflow.
8. **Restore local state (always — on success, error, or interruption):** `git checkout {originalRef}`; if you stashed, `git stash pop`. If any step from 5 onward fails, do this **first**, then report and stop.

---

## Workflow: PR Creation

**Trigger:** User asks to create a PR, or `$ARGUMENTS` starts with `create`.

1. **Verify branch is pushed:**
   ```bash
   CURRENT_BRANCH=$(git branch --show-current)
   git rev-list --count "origin/$CURRENT_BRANCH..HEAD" 2>/dev/null
   ```
   If the branch is untracked or has unpushed commits, ask the user whether to push. If yes: `git push -u origin $CURRENT_BRANCH`. If no: stop.
2. **Check for existing PR:** `az repos pr list --repository {repo} --source-branch {currentBranch} --status active --org {org} --project {project} --detect false -o json`. If a PR exists, show its title and ID and ask whether to update instead (→ PR Update workflow).
3. **Get default branch:** `az repos show --repository {repo} --org {org} --project {project} --detect false -o json`; use `defaultBranch` (strip `refs/heads/`) as the target branch.
4. **Gather commit information:** `git log --oneline "origin/{targetBranch}..{currentBranch}"`.
5. **Ask for the work item ID(s)** the PR delivers — the Azure DevOps work item number(s), e.g. `1234`.
6. **Check for PR template:** Glob for `.azuredevops/pull_request_template.md` in the repo root; if found, read it.
7. **Generate title and description:**
   **Title format:** `Icon #<WorkItemId> Component - Änderungsbeschreibung`
   - **Icon** by majority vote over commit messages: 🐞 bug fixes (`fix`/`bugfix`/`hotfix`); 🏗️ refactor (`refactor`/`cleanup`/`restructure`); 📖 docs (`docs`/`documentation`); 🏆 features or unclear (default). Tie-break: most recent commit's category.
   - **#<WorkItemId>:** the Azure DevOps work item this PR delivers, written as `#1234` (in ADO, `#id` auto-links to the work item).
   - **Component:** from conventional-commit scopes first, else from file paths.
   - **Änderungsbeschreibung:** concise German summary.
   **Description (German):** reference the linked work item(s) as `#1234` (auto-links). If a template was found, use it as structure and put the `#1234` reference in a suitable section; if no template, lead with a short German summary that references `#1234`, then the commit list.
   *(Reminder: per Quirks, the emoji icon will be missing from the CLI's returned JSON — that is expected, the PR has it.)*
8. **Present to user for review:** show generated title and full description; apply requested changes; repeat until approved.
9. **Create the PR:** `az repos pr create --repository {repo} --source-branch {source} --target-branch {target} --title "{title}" --description "{description}" --org {org} --project {project} --detect false -o json` (branch names without `refs/heads/`). Note the `pullRequestId`.
10. **Link the work item(s) to the PR** (the direct association, in addition to the `#id` mention): `az repos pr work-item add --id {prId} --work-items {id} [{id2} …] --org {org} -o json`.
11. **Report result:** show the PR URL and ID (`pullRequestId`), and the linked work item(s).

---

## Workflow: PR Update

**Trigger:** User asks to update a PR, or `$ARGUMENTS` starts with `update`.

1. **Find the PR:** determine the current branch first (`currentBranch=$(git branch --show-current)`), then `az repos pr list --repository {repo} --source-branch {currentBranch} --status active --org {org} --project {project} --detect false -o json`.
   - None found: ask for the PR ID, then `az repos pr show --id {prId} --org {org} -o json`.
   - One found: use it. Multiple: show list (ID + title), ask which.
2. **Show current PR state:** display current title and description, and the linked work items (`az repos pr work-item list --id {prId} --org {org} -o json`).
3. **Ask what to update:** title, description, status, or linked work item(s).
4. **Generate updated values** following the same conventions as PR Creation (German; title schema `Icon #<WorkItemId> Component - Änderungsbeschreibung`).
5. **Present changes for confirmation:** old vs new.
6. **Update the PR:** `az repos pr update --id {prId} [--title "{newTitle}"] [--description "{newDescription}"] [--status active|abandoned|completed] --org {org} -o json`. Include only the flags for fields being changed (the brackets mark optional flags — omit those you are not updating). To change linked work items: `az repos pr work-item add --id {prId} --work-items {id} --org {org} -o json` (or `... work-item remove ... --work-items {id}`).
7. **Report result:** confirm the update and show the PR URL. *(Per Quirks, ignore a missing emoji in the returned JSON.)*

---

## Workflow: PR Comments

**Trigger:** User asks to add a comment to a PR, reply to a PR comment, or resolve/reopen a
comment thread, or `$ARGUMENTS` starts with `comment`.

ADO PR comments live in **threads**; each thread has one or more comments and a `status`
(`active`, `fixed` = resolved, `closed`, `wontFix`, `byDesign`, `pending`). The az CLI has no
first-class comment command, so use `az devops invoke` against the `git` area. POST/PATCH
bodies are passed as a file via `--in-file` — write them with `mktemp`, and **JSON-escape**
the comment text (quotes, newlines). If a `--resource` name is rejected, discover it with
`az devops invoke --query "[?area=='git']"`.

1. **Find the PR:** as in PR Update — current branch via `az repos pr list ...`, else ask for
   the ID; then `az repos pr show --id {prId} --org {org} -o json`.
2. **List threads** (needed to reply/resolve): `az devops invoke --area git --resource pullRequestThreads --route-parameters project={project} repositoryId={repo} pullRequestId={prId} --org {org} --api-version 7.1 -o json`. Skip system-only threads (every comment `commentType: "system"`); show each human thread's `id` (threadId), `status`, and its comments (`id`, author, `content`).

### Add a comment (new thread)
1. Get the comment text. For a code comment, also get the file path (from repo root) and line.
2. Write the body to a temp file (add `threadContext` only for a file/line-anchored comment):
   ```bash
   f=$(mktemp); cat > "$f" <<'JSON'
   { "comments": [ { "parentCommentId": 0, "content": "<text>", "commentType": "text" } ],
     "status": "active",
     "threadContext": { "filePath": "/path/from/repo/root",
       "rightFileStart": { "line": <N>, "offset": 1 },
       "rightFileEnd": { "line": <N>, "offset": 1 } } }
   JSON
   ```
3. POST it: `az devops invoke --area git --resource pullRequestThreads --route-parameters project={project} repositoryId={repo} pullRequestId={prId} --http-method POST --in-file "$f" --media-type application/json --org {org} --api-version 7.1 -o json`; then `rm "$f"`.

### Reply to a thread (answer)
1. From the thread list, note the `threadId` and the **last** comment's `id` in it (the `parentCommentId`).
2. Body: `f=$(mktemp); printf '{ "parentCommentId": <lastCommentId>, "content": "<text>", "commentType": "text" }' > "$f"`.
3. POST it: `az devops invoke --area git --resource pullRequestThreadComments --route-parameters project={project} repositoryId={repo} pullRequestId={prId} threadId={threadId} --http-method POST --in-file "$f" --media-type application/json --org {org} --api-version 7.1 -o json`; then `rm "$f"`.

### Resolve / reopen a thread
1. Note the `threadId`.
2. Body — `{ "status": "fixed" }` to resolve (or `"closed"`), `{ "status": "active" }` to reopen:
   `f=$(mktemp); printf '{ "status": "fixed" }' > "$f"`.
3. PATCH it: `az devops invoke --area git --resource pullRequestThreads --route-parameters project={project} repositoryId={repo} pullRequestId={prId} threadId={threadId} --http-method PATCH --in-file "$f" --media-type application/json --org {org} --api-version 7.1 -o json`; then `rm "$f"`.

Report what changed: the new comment/thread `id`, or the thread's new `status`.

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

---

## Workflow: Work Item Management

**Trigger:** User asks to create, show, query, or update an Azure DevOps **work item**
(German: *Arbeitselement* — e.g. *Aufgabe*, *Fehler*, *Benutzergeschichte*), or
`$ARGUMENTS` starts with `workitem` (e.g. `workitem create`, `workitem show 1234`,
`workitem update 1234`).

> **German installation — never assume English type/state names.** Our Server is
> German, so work item **types** and **states** are localized: `Task` → **Aufgabe**,
> `Bug` → **Fehler**; states like `New`/`Active`/`Closed` appear as
> **Neu**/**Aktiv**/**Geschlossen**. The exact names depend on the project's process
> template, so **fetch them from the server first** (step 1) instead of guessing.

### Step 1 — Discover the localized types and states (do this BEFORE create/query/update)
Fetch the project's real work item types so you use the actual German names:
```bash
az devops invoke --area wit --resource workItemTypes \
  --route-parameters project={project} --org {org} --api-version 7.1 -o json
```
Use each type's `name` field (the localized display name, e.g. `Aufgabe`) — that is what
`--type` and WIQL `[System.WorkItemType]` values expect. If the `--resource` name is
rejected, discover the correct one with `az devops invoke --query "[?area=='wit']"` and
match the `routeTemplate`.

For state values, read the chosen type's localized states:
```bash
az devops invoke --area wit --resource workItemTypeStates \
  --route-parameters project={project} type={germanTypeName} --org {org} --api-version 7.1 -o json
```
Only fall back to an English guess if discovery genuinely fails — and tell the user you did.

### Create
1. Run **step 1**. If the user named a type in English (e.g. "task"), map it to the
   matching German `name` from the fetched list (`Aufgabe`). If there is no clear match,
   show the available types and ask which to use — do not invent one.
2. Gather: title (required), type, description, and optionally assignee, area, iteration,
   and a parent work item to link.
3. Create the work item:
   ```bash
   az boards work-item create --title "{title}" --type "{germanTypeName}" \
     [--description "{description}"] [--assigned-to "{user}"] \
     [--area "{area}"] [--iteration "{iteration}"] \
     --org {org} --project {project} -o json
   ```
4. **Optional — link to a parent:**
   ```bash
   az boards work-item relation add --id {newId} --relation-type parent \
     --target-id {parentId} --org {org} -o json
   ```
5. Report the new work item ID and URL. *(Per Quirks, an emoji in the title may be absent
   from the returned JSON — expected; the work item has it.)*

### Show / Query
- **Show one:** `az boards work-item show --id {id} --org {org} -o json`.
- **Query many (WIQL):** build the query with the localized values from step 1:
  ```bash
  az boards query --org {org} --project {project} -o json \
    --wiql "SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.WorkItemType] = 'Aufgabe' AND [System.State] <> 'Geschlossen' ORDER BY [System.ChangedDate] DESC"
  ```
  Field reference names (`[System.WorkItemType]`, `[System.State]`) are invariant English;
  the **values** (`'Aufgabe'`, `'Geschlossen'`) are the localized names from step 1.

### Update
1. Identify the work item (ID from the user, or via Show/Query above).
2. For a **state** change, get the valid localized states for its type from step 1 first.
3. Update only the fields being changed:
   ```bash
   az boards work-item update --id {id} [--title "{title}"] [--state "{germanState}"] \
     [--assigned-to "{user}"] [--description "{description}"] --org {org} -o json
   ```
4. Confirm the change and report the work item URL.
