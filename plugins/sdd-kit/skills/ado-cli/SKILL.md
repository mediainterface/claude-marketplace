---
name: ado-cli
description: >-
  Work with Azure DevOps via the Azure CLI (az + azure-devops extension) —
  analyse pipeline failures, review pull requests, create and update pull requests,
  and generate changelogs since a given build or commit. This is the CLI variant
  of the azure-devops skill, for Azure DevOps cloud and the newest on-prem Server
  version. Use when the user mentions ADO pipelines, builds, PRs, changelogs, or
  pastes Azure DevOps URLs and the repo targets the cloud / newest server, or when
  the user asks to use the az CLI for Azure DevOps.
argument-hint: <PIPELINE_URL_OR_BUILD_ID | PR_ID_OR_URL | create | update | changelog>
allowed-tools: Bash, Read, Glob, Grep
---

# Azure DevOps CLI Skill

This skill mirrors the `azure-devops` skill but talks to the server through the
Azure CLI (`az`) with the `azure-devops` extension instead of REST/MCP. Use it for
Azure DevOps **cloud** and the **newest** on-prem Server version. The MCP-based
`azure-devops` skill remains the right choice for the older Server version.

## Step 0: Detect ADO Connection

1. Run `git remote get-url origin` via Bash.
2. Parse the remote URL into `organization` (a full URL), `project`, and `repository`.
   Recognise these forms:
   - **Cloud:** `https://dev.azure.com/{org}/{project}/_git/{repo}` or
     `https://{org}@dev.azure.com/{org}/{project}/_git/{repo}`
     → `organization = https://dev.azure.com/{org}`
   - **Newest on-prem Server:** `https://{host}[:port]/{collection}/{project}/_git/{repo}`
     → `organization = https://{host}[:port]/{collection}`
   - **SSH:** `git@ssh.dev.azure.com:v3/{org}/{project}/{repo}`
     → `organization = https://dev.azure.com/{org}`
3. If the URL matches none of these, tell the user this skill only works with Azure
   DevOps repositories and stop.
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

3. **Authenticated (Entra ID):**
   ```bash
   az account show
   ```
   If this fails:
   > **You are not signed in.** Run `az login` and complete the browser sign-in
   > (Entra ID), then re-run. For an on-prem Server that uses the same Entra tenant,
   > `az login` is sufficient.

After giving any of these instructions, **stop** — do not attempt further `az` calls.

## Quirks — expected false signals (do NOT treat as errors)

The Azure CLI produces two misleading outputs that are safe to ignore. In both cases,
**proceed as if the operation succeeded**; the user will call it out if something
genuinely failed.

1. **Emoji stripped from return value.** When a PR or work item title/description
   contains an emoji, the CLI applies the emoji correctly to the resource, but the JSON
   it prints back omits the emoji. This is expected. Do **not** retry, "fix", or warn
   about a missing emoji — the resource has it.

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
| PR comment threads | `az devops invoke --area git --resource pullRequestThreads --route-parameters project={project} repositoryId={repo} pullRequestId={prId} --org {org} --api-version 7.1 -o json` |

**CLI-vs-REST differences to remember:**
- `--source-branch` / `--target-branch` take the **bare** branch name (`feature/x`), NOT
  `refs/heads/feature/x`. Always strip the `refs/heads/` prefix before passing.
- `az repos show` returns `defaultBranch` as `refs/heads/{name}` — strip the prefix for
  local git operations, same as the REST skill.
- The task-log `invoke` returns a JSON object with a `value` array of log lines; join
  that array to reconstruct the plain-text log.

## Repository Mismatch Check

When the user provides a URL or build ID, the referenced resource may belong to a
different repository than the one you are in. After fetching metadata, compare the
repository name in the response against the local `repository` from Step 0. If they
differ, warn before proceeding:
> "The build/PR belongs to repository **{remote repo}**, but you are currently in
> **{local repo}**. Local git operations (reading pipeline YAML, checking out branches,
> generating diffs) will use the wrong codebase. Do you want to continue anyway?"

Only proceed if the user explicitly confirms.
