# ado-toolkit

Azure DevOps Server for Claude Code, through the Azure CLI (`az` with the `azure-devops`
extension). Three skills cover the day-to-day work around tickets, pull requests and pipelines:

| Skill | What it does |
|---|---|
| `/ado-workitem` | Create, show, query (WIQL), update and comment on work items (tickets). Each type's content goes into its own field (acceptance criteria, repro steps, resolution), Area and Iteration onto the team the user names. Types, states and relation types are read from the server, because ours is German-localized (`Aufgabe`, not `Task`). |
| `/ado-pr` | Review a PR, create or update one (German title schema, work item linked and referenced as `#id`), and add, answer or resolve comment threads. |
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

## Install

```
claude plugin install ado-toolkit@mediainterface
```
