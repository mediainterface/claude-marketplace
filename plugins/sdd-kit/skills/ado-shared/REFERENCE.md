# Azure DevOps via the Azure CLI — shared reference

Shared setup and reference for the Azure DevOps CLI skills (`ado-pr`, `ado-workitem`,
`ado-pipeline`). They talk to Azure DevOps through the Azure CLI (`az`) with the
`azure-devops` extension instead of REST/MCP, and target the **newest** Azure DevOps
**Server** version. The MCP-based `azure-devops` skill remains the right choice for the older
Server version.

**Complete Step 0 and the Setup Check below once, before any `az` command.** The Command Map,
Repository Mismatch Check, Quirks, and Error-handling rules here apply to all three skills.

> **German-localized Server.** Our Azure DevOps is German, so work item types and states are
> German (e.g. `Aufgabe`, not `Task`) — fetch them from the server rather than assuming
> English names. The skills assume you are **already signed in**; they never authenticate for
> you (see Setup Check step 3).

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
> 4. Select the scopes the skills' workflows need:
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
   CLI has been fully tested against our server and every workflow works.
   Ignore the warning and continue.

## Command Map (REST endpoint → az command)

`{org}` = `organization`, `{project}`, `{repo}` = `repository` from Step 0. Request JSON
with `-o json`. For endpoints without a first-class command, use `az devops invoke`
(it authenticates the same way). If an `invoke` `--resource` name is ever rejected,
discover the correct one with `az devops invoke --query "[?area=='build']"` (or
`'git'` / `'wit'`) and match the `routeTemplate`.

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
  these German names — fetch them from the server (see the `ado-workitem` skill) rather than
  assuming. WIQL *field reference names* (`System.WorkItemType`, `System.State`) stay
  invariant English.

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
