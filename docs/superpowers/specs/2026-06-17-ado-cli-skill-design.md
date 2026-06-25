# Design: `ado-cli` skill (Azure DevOps via Azure CLI)

**Date:** 2026-06-17
**Branch:** `feature/ado-cli-skill`
**Status:** Approved design — ready for implementation plan

> **Revision (2026-06-25):** Scope narrowed to **on-prem Azure DevOps Server only**, and
> auth changed from Entra/`az login` to a **Personal Access Token** (`AZURE_DEVOPS_EXT_PAT`).
> Azure DevOps **cloud is dropped** — on-prem and cloud require different auth methods and we
> run on-prem. A sixth workflow — **Work Item Management** — was also added: our Server is
> German-localized, so it fetches the localized work item types/states from the server
> (`Aufgabe`, not `Task`) instead of assuming English names. Where the original text below
> says "cloud", `az login`, or "five workflows", the live `SKILL.md` is authoritative.

## Problem

The existing `azure-devops` plugin talks to Azure DevOps **Server** over REST through
a bundled MCP server (`ado_get`/`ado_post`/`ado_patch`/`ado_delete` + `parse_ado_remote`).
It works against our **older** on-prem server version.

We also run the **newest** on-prem server version. For that we want a skill that does the
same jobs but communicates through the **Azure CLI** (`az`) with the **azure-devops
extension** instead of REST/MCP. (Azure DevOps cloud was considered but dropped — see the
revision note above; we do not run it, and it would need a different auth method.)

Both must coexist: the MCP plugin is **not** removed. The new skill is added under the
`sdd-kit` plugin.

## Goals

Mirror the five workflows of the existing skill, byte-for-byte where local git is involved,
swapping only the transport (REST/MCP → `az` CLI):

1. Pipeline analysis (build failure diagnosis)
2. PR review
3. PR creation
4. PR update
5. Changelog since a build/commit

Non-goals: removing or changing the existing `azure-devops` plugin; new conventions.

## Decisions

| Topic | Decision |
|---|---|
| Skill name | `ado-cli` (invoked as `/ado-cli`) |
| Location | `plugins/sdd-kit/skills/ado-cli/SKILL.md` |
| Plugin | `sdd-kit` (existing) |
| Scope | All five workflows (mirror existing); **on-prem Server only — no cloud** |
| Auth | **Personal Access Token** via `AZURE_DEVOPS_EXT_PAT` (or `az devops login`) — *not* `az login`/Entra |
| Conventions | Identical to existing skill (German PR titles, icon majority-vote, Asana `ID-XXXXX`, PR template handling) |
| Transport | **Hybrid (Approach A)** — see below |
| Existing plugin | Untouched |

### Approach A — Hybrid CLI transport (chosen)

Use first-class `az` commands where they exist:

- `az repos pr show / create / update / list`
- `az pipelines build show`
- `az repos show` (repository metadata, default branch)

Fall back to `az devops invoke` for endpoints the high-level CLI does not surface:

- Build **timeline** (`--area build --resource Timeline`)
- Task **logs** (`--area build --resource logs`, plain text)
- PR **comment threads** (`--area git --resource pullRequestThreads`)

All structured output requested as JSON (`-o json`). The CLI handles auth (via the PAT in
`AZURE_DEVOPS_EXT_PAT`) for both the high-level commands and `az devops invoke`, so the setup
manual only needs the PAT to be present once.

Rejected: **B** (everything via `az devops invoke` — loses ergonomics, more verbose for no
gain) and **C** (high-level commands only — can't do timeline/logs, so pipeline analysis
would be crippled).

## Skill structure

Frontmatter:

```yaml
name: ado-cli
description: >-
  <triggers on ADO pipelines/builds/PRs/changelogs; states this is the CLI variant
  for Azure DevOps cloud and the newest server version>
argument-hint: <PIPELINE_URL_OR_BUILD_ID | PR_ID_OR_URL | create | update | changelog>
allowed-tools: Bash, Read, Glob, Grep
```

No MCP tools in `allowed-tools`.

### Step 0 — Connection detection (replaces `parse_ado_remote`)

1. `git remote get-url origin`.
2. Parse the remote ourselves (on-prem Server only). Recognise:
   - On-prem HTTPS: `https://{host}[:port]/{collection}/{project}/_git/{repo}`
   - On-prem SSH: `ssh://{host}[:port]/{collection}/{project}/_git/{repo}` or
     `{user}@{host}:{collection}/{project}/_git/{repo}`
   - A cloud remote (`dev.azure.com` / `ssh.dev.azure.com`) → stop: not supported here.
3. Derive `organization` URL, `project`, `repository`.
4. `az devops configure --defaults organization=<orgUrl> project=<project>` and ALSO pass
   `--org`/`--project` explicitly on each call to stay robust.
5. If parsing fails → tell the user the skill only works on Azure DevOps repos and stop.

### Setup manual (new — replaces "Authorization Troubleshooting")

Preconditions check + exact instructions on failure:

1. Azure CLI installed (`az version`). If missing → install instructions.
2. azure-devops extension installed (`az extension add --name azure-devops` /
   `az extension show --name azure-devops`).
3. Authenticated via **PAT**: verify with `az devops project list --org {org}`. If it
   401/403s or reports not signed in → PAT setup instructions (`AZURE_DEVOPS_EXT_PAT`,
   or `az devops login`). *Not* `az login`/Entra — that is the cloud path.

On any failure, give exact commands and **stop** — no further `az` calls.

### Quirks (new section)

Document the two known false-signal behaviours; both mean "proceed, the operation worked":

1. **Emoji stripping.** When a PR or work item title/description contains an emoji, the CLI
   applies it correctly to the resource, but the JSON return value omits the emoji. This is
   expected. Treat the operation as successful. The user will call it out if something
   genuinely failed.
2. **False compatibility warning.** The CLI may warn that it is not compatible with this
   server version. This is a **false positive** — the CLI has been fully tested against our
   server and everything works. Ignore the warning and proceed.

### CLI command map

A table mapping each REST endpoint from the existing skill to its `az` equivalent (or the
`az devops invoke` fallback). Covers: build metadata, timeline, logs, changes, definition;
repo metadata, PR show/create/update/list, PR threads.

### Workflows

Same step structure, headings, and output format as the existing skill. Only the
server-communication calls change to `az`. These pieces are carried over unchanged:

- Repository-mismatch check (compare CLI-returned repo name vs local Step 0 repo).
- All local git operations: `git fetch`, `git diff`/`--stat`/`--name-status`, `git log`,
  checkout + stash/restore, deleted-source-branch SHA fallback.
- PR creation conventions: German title schema `Icon <Asana-ID> Component - Beschreibung`,
  icon majority-vote (🐞/🏗️/📖/🏆), Asana `ID-XXXXX` link, `.azuredevops/pull_request_template.md`
  handling, present-for-approval loop.
- Changelog three-section output (commit log, file overview, narrative summary).

## Documentation updates

- `plugins/sdd-kit/.claude-plugin/plugin.json` — extend description to mention `/ado-cli`.
- `.claude-plugin/marketplace.json` — update the `sdd-kit` entry description.
- Root `CLAUDE.md` — add `ado-cli` under the `sdd-kit` section and note repository structure.

## Out of scope / risks

- We do not verify live `az` behaviour in this repo (no Azure access here); correctness of
  command syntax is reviewed against Azure CLI docs.
- `az devops invoke` route parameters for timeline/logs must be confirmed against the
  azure-devops extension docs during implementation.
