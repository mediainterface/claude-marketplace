---
name: azure-devops
description: >-
  Work with Azure DevOps Server — analyse pipeline failures, review pull requests,
  create and update pull requests, and generate changelogs since a given build or commit.
  Use when the user mentions ADO pipelines, builds, PRs, changelogs,
  or pastes Azure DevOps URLs. Also trigger for PR creation/update requests
  in repositories with an Azure DevOps Server remote.
argument-hint: <PIPELINE_URL_OR_BUILD_ID | PR_ID_OR_URL | create | update | changelog>
allowed-tools: Bash, Read, Glob, Grep, mcp__ado__*
---

# Azure DevOps Unified Skill

## Step 0: Detect ADO Connection

1. Run `git remote get-url origin` via Bash.
2. Call `parse_ado_remote` with the remote URL.
3. If parsing fails, tell the user this skill only works with Azure DevOps Server repositories and stop.
4. If `parse_ado_remote` fails because the `ado` MCP server is not running (tool not found / connection error), the `ADO_PAT` environment variable is most likely missing. Follow the **Authorization Troubleshooting** section below and stop.
5. Store the returned `server`, `collection`, `project`, `repository` values — use them for ALL subsequent `ado_get`, `ado_post`, `ado_patch`, `ado_delete` calls.

## Authorization Troubleshooting

If any MCP tool call fails because the `ado` server is unavailable or returns an authentication/authorization error (HTTP 401/403), tell the user **exactly** what to do:

> **The Azure DevOps MCP server could not start or authenticate because `ADO_PAT` is not set or is invalid.**
>
> You need a Personal Access Token (PAT) for your Azure DevOps Server instance.
>
> **How to create a PAT:**
> 1. Open your Azure DevOps Server in the browser.
> 2. Click your profile picture (top right) → **Security** → **Personal access tokens**.
> 3. Click **+ New Token**.
> 4. Give it a descriptive name (e.g. `claude-code`).
> 5. Set the expiration as desired.
> 6. Select the required scopes:
>    - **Code**: Read & Write (for PR creation/update and repository access)
>    - **Build**: Read (for pipeline analysis)
> 7. Click **Create** and copy the token.
>
> **How to provide the PAT to Claude Code:**
>
> Add it to your shell environment (e.g. `~/.bashrc`, `~/.zshrc`, or `~/.env`):
> ```bash
> export ADO_PAT="your-personal-access-token"
> ```
> Then restart your terminal / Claude Code session so the MCP server picks it up.

After providing these instructions, **stop** — do not attempt any further ADO API calls.

## Repository Mismatch Check

When the user provides a URL or build ID, the referenced resource may belong to a different repository than the one you are currently in. After fetching metadata from the API (build metadata, PR metadata), compare the `repository.name` field from the response against the local `repository` value from Step 0.

If they differ, **warn the user before proceeding**:
> "The build/PR belongs to repository **{remote repo}**, but you are currently in **{local repo}**. Local git operations (reading pipeline YAML, checking out branches, generating diffs) will use the wrong codebase. Do you want to continue anyway?"

Only proceed if the user explicitly confirms.

## MCP Tool Reference

Five MCP tools are available via the `ado` server:

| Tool | Parameters | Description |
|------|-----------|-------------|
| `ado_get` | server, collection, project, path, accept? | HTTP GET |
| `ado_post` | server, collection, project, path, body, accept? | HTTP POST |
| `ado_patch` | server, collection, project, path, body, accept? | HTTP PATCH |
| `ado_delete` | server, collection, project, path, accept? | HTTP DELETE |
| `parse_ado_remote` | remote_url | Parse git remote into components |

- `path`: API path relative to `{server}/{collection}/{project}/_apis` — e.g. `/build/builds/123`
- `path` may include query parameters (e.g. `?searchCriteria.status=active`)
- `body`: JSON string for POST/PATCH
- `accept`: Override Accept header (default: `application/json`). Use `text/plain` for build logs.
- `server`, `collection`, `project`: Always use the values from Step 0's `parse_ado_remote` call.

## API Reference

### Build Endpoints

| Endpoint | Description |
|---|---|
| `GET /build/builds/{buildId}` | Build metadata (pipeline name, status, source branch, trigger reason, start/finish times, definition ID) |
| `GET /build/builds/{buildId}/timeline` | Execution timeline — array of records (stages, jobs, tasks) with `type`, `name`, `state`, `result`, `issues[]`, `log.id` |
| `GET /build/builds/{buildId}/logs/{logId}` | Plain text log for a specific task (use `log.id` from timeline). Use `accept="text/plain"`. |
| `GET /build/builds/{buildId}/changes` | Commits associated with the build. Each entry has `id`, `message`, `author`, `timestamp`. |
| `GET /build/definitions/{definitionId}` | Pipeline definition metadata. Key field: `process.yamlFilename` for YAML pipelines. |

### Git / PR Endpoints

| Endpoint | Description |
|---|---|
| `GET /git/repositories/{repo}` | Repository metadata. Key field: `defaultBranch` (e.g., `refs/heads/main`). |
| `GET /git/repositories/{repo}/pullrequests/{prId}` | PR metadata (title, description, status, source/target branches, author, creation date, merge status). |
| `POST /git/repositories/{repo}/pullrequests` | Create a PR. Body: `{ sourceRefName, targetRefName, title, description }`. Ref names must be `refs/heads/{branch}`. |
| `PATCH /git/repositories/{repo}/pullrequests/{prId}` | Update a PR. Body: only fields to change (`title`, `description`, `status`). Status values: `active`, `abandoned`, `completed`. |
| `GET /git/repositories/{repo}/pullrequests?searchCriteria.sourceRefName=refs/heads/{branch}&searchCriteria.status=active` | Search for active PRs by source branch. Returns `{ value: [...] }`. |
| `GET /git/repositories/{repo}/pullrequests/{prId}/threads` | PR comment threads. Filter out threads where all comments have `commentType: "system"`. |

---

## Workflow: Pipeline Analysis

**Trigger:** User provides a pipeline URL (containing `/_build/results?buildId=`) or a numeric build ID, or asks about a build failure.

### Steps

1. **Parse input:** Extract `buildId` from URL query parameter, or use the numeric ID directly.

2. **Fetch build metadata:**
   ```
   ado_get(server, collection, project, path="/build/builds/{buildId}")
   ```
   Note the `definition.id` for step 6, and the `sourceBranch`, `requestedFor`, `startTime`, `finishTime`, `result`.
   **Repository check:** Compare `repository.name` from the response against the local `repository` from Step 0. If they differ, warn the user (see "Repository Mismatch Check" above) and stop unless confirmed.

3. **Fetch timeline:**
   ```
   ado_get(server, collection, project, path="/build/builds/{buildId}/timeline")
   ```
   From the `records` array, identify entries where `result` is `"failed"` and `type` is `"Task"`. Note their `log.id` and any `issues[]` entries.

4. **Fetch logs for each failed task:**
   ```
   ado_get(server, collection, project, path="/build/builds/{buildId}/logs/{logId}", accept="text/plain")
   ```
   Extract error lines matching: `##[error]`, `error:`, `error `, `FAILED`, `fatal:`, `fatal `, `exception:`, `exception ` (case-insensitive). Focus your analysis on these error lines rather than dumping the full log.

5. **Fetch associated commits:**
   ```
   ado_get(server, collection, project, path="/build/builds/{buildId}/changes")
   ```

6. **Checkout the build's source branch** so local files match what the build ran against:
   - Note the current branch: `git branch --show-current` (or `git rev-parse HEAD` if detached)
   - Stash uncommitted changes if any: `git stash -u`
   - Strip `refs/heads/` prefix from `sourceBranch` (from step 2)
   - Fetch and checkout: `git fetch origin {sourceBranch} && git checkout origin/{sourceBranch} --detach`
   - If the branch no longer exists, use `sourceVersion` (commit SHA) from the build metadata instead: `git fetch origin {sourceVersion} && git checkout {sourceVersion} --detach`

7. **Fetch pipeline definition:**
   ```
   ado_get(server, collection, project, path="/build/definitions/{definitionId}")
   ```
   If `process.yamlFilename` is present, read that YAML file from the local repo. Follow `template:` references to read template files too.

8. **Analyse and report** — provide:
   - **Error summary**: What failed and one-sentence root cause
   - **Detailed analysis**: Walk through error logs, connect to pipeline steps and source code
   - **Root cause**: Distinguish symptom (error message) from cause (what's actually wrong). Identify the responsible commit if applicable.
   - **Suggested fix**: Concrete steps with code/config changes
   - **Prevention**: How to prevent this class of error in the future

   Common failure categories: build errors, test failures, deployment errors, infrastructure errors, configuration errors, dependency issues.

9. **Restore original branch:**
   - `git checkout {originalBranch}` (or `git checkout {originalCommit}` if was detached)
   - If stashed: `git stash pop`

---

## Workflow: PR Review

**Trigger:** User provides a PR ID (numeric) or a PR URL, or asks to review a PR.

### Steps

1. **Parse input:** Extract PR ID from the URL path or use the numeric ID directly.

2. **Fetch PR metadata:**
   ```
   ado_get(server, collection, project, path="/git/repositories/{repo}/pullrequests/{prId}")
   ```
   Note `sourceRefName`, `targetRefName`, `title`, `description`, `createdBy`, `creationDate`, `status`.
   **Repository check:** Compare `repository.name` from the response against the local `repository` from Step 0. If they differ, warn the user (see "Repository Mismatch Check" above) and stop unless confirmed.

3. **Generate local git diffs:**
   Strip `refs/heads/` prefix from source and target branch names, then:
   ```bash
   git fetch origin {sourceBranch} {targetBranch}
   git diff --name-status origin/{targetBranch}...origin/{sourceBranch}
   git diff --stat origin/{targetBranch}...origin/{sourceBranch}
   git diff origin/{targetBranch}...origin/{sourceBranch}
   git log --oneline origin/{targetBranch}...origin/{sourceBranch}
   ```
   **If the source branch no longer exists** (e.g., already merged and deleted), `git fetch` will fail. In this case, check if the PR metadata contains `lastMergeSourceCommit.commitId` and use that commit SHA instead of the branch name: `git fetch origin {commitId}` then diff against `{commitId}` instead of `origin/{sourceBranch}`.

   **If git operations fail for any other reason, report the error to the user and stop.** Do NOT fall back to API-based changes.

4. **Fetch PR comment threads:**
   ```
   ado_get(server, collection, project, path="/git/repositories/{repo}/pullrequests/{prId}/threads")
   ```
   Filter out system-generated threads (where all comments have `commentType: "system"`). Show human comments.

5. **Checkout the source branch** so you can explore the full codebase in its PR state:
   - Note the current branch: `git branch --show-current` (or `git rev-parse HEAD` if detached)
   - Stash uncommitted changes if any: `git stash -u`
   - Checkout: `git checkout origin/{sourceBranch} --detach` (or `git checkout {commitId} --detach` if the deleted-branch SHA fallback was used in step 3)

6. **Gather context:**
   - Read CLAUDE.md files in or near affected directories
   - Read related files that changed code imports, extends, or interfaces with
   - Use Glob and Grep to find similar patterns and conventions

7. **Review the PR** covering:
   - **Summary**: What the PR does
   - **Code Quality**: Readability, naming, maintainability
   - **Correctness**: Logic errors, edge cases, error handling
   - **Security**: Injection, XSS, secrets, OWASP top 10
   - **Performance**: Inefficiencies, N+1 queries
   - **Architecture**: Adherence to project patterns
   - **Testing**: Whether changes are adequately tested

   Be specific — reference file paths and line numbers. Distinguish blockers from suggestions.

8. **Restore original branch:**
   - `git checkout {originalBranch}` (or `git checkout {originalCommit}` if was detached)
   - If stashed: `git stash pop`

---

## Workflow: PR Creation

**Trigger:** User asks to create a PR, or `$ARGUMENTS` starts with `create`.

### Steps

1. **Verify branch is pushed:**
   ```bash
   CURRENT_BRANCH=$(git branch --show-current)
   git rev-list --count "origin/$CURRENT_BRANCH..HEAD" 2>/dev/null
   ```
   If the branch is not tracked or has unpushed commits, inform the user and ask if they want to push. If yes: `git push -u origin $CURRENT_BRANCH`. If no: stop.

2. **Check for existing PR:**
   ```
   ado_get(server, collection, project, path="/git/repositories/{repo}/pullrequests?searchCriteria.sourceRefName=refs/heads/{branch}&searchCriteria.status=active")
   ```
   If a PR exists, inform the user (show title and ID) and ask if they want to update it instead. If yes, switch to **PR Update** workflow.

3. **Get default branch:**
   ```
   ado_get(server, collection, project, path="/git/repositories/{repo}")
   ```
   Use the `defaultBranch` field (strip `refs/heads/` prefix) as the target branch.

4. **Gather commit information:**
   ```bash
   git log --oneline "origin/{targetBranch}..{currentBranch}"
   ```

5. **Ask for Asana ticket ID** — format: `ID-XXXXX` (e.g., `ID-17885`).

6. **Check for PR template:**
   Use Glob to check for `.azuredevops/pull_request_template.md` in the repo root. If found, read it.

7. **Generate title and description:**

   **Title format:** `Icon <Asana-Ticket-Id> Component - Änderungsbeschreibung`

   - **Icon**: Infer from commit messages by majority vote:
     - 🐞 if majority indicate bug fixes (`fix`, `bugfix`, `hotfix`)
     - 🏗️ if majority indicate refactoring (`refactor`, `cleanup`, `restructure`)
     - 📖 if majority indicate documentation (`docs`, `documentation`)
     - 🏆 for features or if unclear (default)
     - Tie-break: use the most recent commit's category
   - **Component**: Derive from conventional commit scopes first, then from file paths if no scopes
   - **Änderungsbeschreibung**: Concise German summary of the changes

   **Description**: Must be in German.
   - If PR template found: use template as structure, fill in sections from commit log, integrate Asana ticket link (`https://app.asana.com/0/search?q=ID-XXXXX`) in an appropriate section (or add `## Asana` section)
   - If no template: create description with `## Asana` section at top with ticket link, summary of changes (German), list of commits

8. **Present to user for review:** Show generated title and full description. Apply changes if requested. Repeat until approved.

9. **Create the PR:**
   ```
   ado_post(server, collection, project, path="/git/repositories/{repo}/pullrequests", body='{"sourceRefName":"refs/heads/{source}","targetRefName":"refs/heads/{target}","title":"{title}","description":"{description}"}')
   ```

10. **Report result:** Show the PR URL and ID.

---

## Workflow: PR Update

**Trigger:** User asks to update a PR, or `$ARGUMENTS` starts with `update`.

### Steps

1. **Find the PR:**
   ```
   ado_get(server, collection, project, path="/git/repositories/{repo}/pullrequests?searchCriteria.sourceRefName=refs/heads/{currentBranch}&searchCriteria.status=active")
   ```
   - If no PR found: ask the user for the PR ID, then fetch it:
     ```
     ado_get(server, collection, project, path="/git/repositories/{repo}/pullrequests/{prId}")
     ```
   - If one PR found: use it
   - If multiple found: show list (ID + title), ask user which one

2. **Show current PR state:** Display current title and description.

3. **Ask what to update:** Title, description, or Asana link.

4. **Generate updated values** following the same formatting rules as the Create workflow (German language, title schema with icon/Asana-ID/component).

5. **Present changes for confirmation:** Show old vs. new values.

6. **Update the PR:**
   ```
   ado_patch(server, collection, project, path="/git/repositories/{repo}/pullrequests/{prId}", body='{"title":"{newTitle}","description":"{newDescription}"}')
   ```
   Only include fields that are being changed.

7. **Report result:** Confirm the update and show the PR URL.

---

## Workflow: Changelog

**Trigger:** User asks what changed since a build or commit, or `$ARGUMENTS` starts with `changelog`.

### Input Resolution

Determine the **base commit SHA** from the user's input:

1. **Build URL** — if input contains `/_build/results?buildId=`, extract the `buildId` from the query parameter, then proceed as build ID.
2. **Build ID** (purely numeric input) — fetch build metadata:
   ```
   ado_get(server, collection, project, path="/build/builds/{buildId}")
   ```
   Extract the `sourceVersion` field — this is the commit SHA.
   **Repository check:** Compare `repository.name` from the response against the local `repository` from Step 0. If they differ, warn the user (see "Repository Mismatch Check" above) and stop unless confirmed.
3. **Commit SHA** (hex string, 7-40 chars) — use directly.

### Steps

1. **Resolve repository name:** Use the `repository` value from Step 0's `parse_ado_remote` call.

2. **Get default branch:**
   ```
   ado_get(server, collection, project, path="/git/repositories/{repo}")
   ```
   Use the `defaultBranch` field. Strip `refs/heads/` prefix for git operations (e.g., `refs/heads/main` → `main`).

3. **Fetch latest from default branch:**
   ```bash
   git fetch origin {defaultBranch}
   ```

4. **Ensure the base commit is available locally:**
   ```bash
   git cat-file -t {commit}
   ```
   If this fails (commit not found), fetch it:
   ```bash
   git fetch origin {commit}
   ```
   If it still fails, report: "Commit {commit} not found locally or on the remote." and stop.

5. **Check if there are changes:**
   ```bash
   git rev-list --count {commit}..origin/{defaultBranch}
   ```
   If the count is `0`, report: "Default branch is at the same commit as the build — no new changes." and stop.

6. **Collect commit log:**
   ```bash
   git log --format='%h %an <%ae> %s' {commit}..origin/{defaultBranch}
   ```

7. **Collect file stats:**
   ```bash
   git diff --stat {commit}..origin/{defaultBranch}
   ```

8. **Collect full diff:**
   ```bash
   git diff {commit}..origin/{defaultBranch}
   ```

### Output

Present three sections:

1. **Commit Log** — all commits between the base commit and `origin/{defaultBranch}`, showing short SHA, author, and commit message.

2. **File Overview** — `git diff --stat` output, grouped by top-level directory or component to show which areas were touched. Include total files changed, insertions, and deletions.

3. **Narrative Summary** — a prose summary describing the changes conceptually: what features were added, what bugs were fixed, what was refactored. Written as a briefing for someone who wants to understand what the next build will include without reading diffs.
