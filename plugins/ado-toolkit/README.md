# ado-toolkit

Azure DevOps Server for Claude Code, through the Azure CLI (`az` with the `azure-devops`
extension). Three skills cover the day-to-day work around tickets, pull requests and pipelines:

| Skill | What it does |
|---|---|
| `/ado-workitem` | Create, show, query (WIQL), update and comment on work items (tickets). Each type's content goes into its own field (acceptance criteria, repro steps, resolution), Area and Iteration onto the team the user names. Type, state, field and relation names are read from the server once and cached per server and project, since they differ by language and process (`Aufgabe`, not `Task`). |
| `/ado-pr` | Review a PR, create or update one (German title schema, work item linked and referenced as `#id`), add, answer or resolve comment threads, and post an automated review's findings file. |
| `/ado-pipeline` | Analyse a failed build (timeline, failed-task logs, root cause, fix) and write a changelog since a build or commit. |

The plugin replaces the MCP-based `azure-devops` plugin, which is obsolete and will be removed.
It stands on its own: no particular development process is assumed. The `sdd-kit` plugin builds
on it for the Spec-Driven Development workflow.

## Prerequisites

- **A git checkout of an Azure DevOps repository.** Its `origin` decides which server and
  project the skills talk to, and the checkout is what many actions work from (a PR from the
  current branch, a work item written from a change). Outside such a checkout the skills stop.
- **Azure CLI** with the **`azure-devops` extension**. The skills check for both and say how to
  install whatever is missing.
- **Signed in** via `az devops login --org <collection URL>` with a Personal Access Token. The
  skills never sign in for you; if you are not signed in, they stop and explain how to create
  the PAT. Scopes: **Work Items** (read & write), **Code** (read & write), **Build** (read) —
  only what your workflows need.
- **Python 3** — only to post an automated review's findings file (`/ado-pr`).

## Posting review findings from a pipeline

A review skill run headless writes its result to a findings file (format in `/ado-pr`, under
**Post a findings file**). A pipeline posts it with the script the skill bundles, without a
model in between — so the reviewed PR cannot steer what gets posted:

```bash
# in the PR's checkout; the step maps System.AccessToken to SYSTEM_ACCESSTOKEN
export AZURE_DEVOPS_EXT_PAT="$SYSTEM_ACCESSTOKEN"
python3 <ado-toolkit>/skills/ado-pr/scripts/post_findings.py "$CONTEXT_DIR/findings.json"
```

`<ado-toolkit>` is this plugin's directory, in a checkout of the marketplace or in the installed
plugin's cache. The agent needs the Azure CLI with the `azure-devops` extension, and the build
identity the repository permission *Contribute to pull requests*. The comments appear under that
identity.

## Install

```
claude plugin install ado-toolkit@mediainterface
```
