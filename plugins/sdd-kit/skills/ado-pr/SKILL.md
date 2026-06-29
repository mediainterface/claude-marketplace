---
name: ado-pr
description: >-
  Azure DevOps pull requests via the Azure CLI (az + azure-devops extension) — review a PR,
  create or update a PR (German title schema, ADO work items linked and referenced as #id),
  and create/answer/resolve PR comment threads. Use when the user mentions an ADO pull
  request / PR, pastes a PR URL or ID, or asks to review, open, update, or comment on a PR.
  Targets the newest Azure DevOps Server version; assumes you are already signed in (PAT).
argument-hint: <PR_ID_OR_URL | create | update | comment [add|reply|resolve]>
allowed-tools: Bash, Read, Glob, Grep
---

# Azure DevOps — Pull Requests (CLI)

Pull-request workflows for Azure DevOps via the Azure CLI (`az` + `azure-devops` extension):
**review**, **create**, **update**, and **comment** on PRs. Use this skill when the user
pastes a PR URL/ID or asks to review, open, update, or comment on an Azure DevOps PR.

> **Shared setup first.** Before any `az` command, complete **Step 0 (connection detection)**
> and the **Setup Check (sign-in confirmation)** in
> [../ado-shared/REFERENCE.md](../ado-shared/REFERENCE.md). That file also holds the
> **Command Map**, **Repository Mismatch Check**, **Quirks**, and **Error handling &
> local-state safety** rules the workflows below refer to. `{org}` = `organization`,
> `{repo}` = `repository`, `{project}` come from Step 0.

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
   even if a later step fails — see "Error handling & local-state safety" in the shared reference):
   - Record the current branch (or commit if detached) as `originalRef`. Remember whether you stash below.
   - Stash uncommitted changes if any: `git stash -u`.
   - `git checkout origin/{sourceBranch} --detach` (or `{commitId} --detach` if the deleted-branch fallback was used in step 3).
6. **Gather context:** read CLAUDE.md files in/near affected dirs; read related files the change imports/extends; use Glob/Grep for conventions.
7. **Review** covering: Summary, Code Quality, Correctness, Security (injection/XSS/secrets/OWASP), Performance (N+1, inefficiencies), Architecture (project patterns), Testing. Reference file paths and line numbers; distinguish blockers from suggestions. **This review is read-only** — it produces the written review for the user; to post comments or resolve threads on the PR, use the **PR Comments** workflow below.
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
