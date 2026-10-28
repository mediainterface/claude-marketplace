# Claude Marketplace

Internal Claude Code plugin marketplace for MediaInterface.

## Usage

Add the marketplace:

```
/plugin marketplace add mediainterface/claude-marketplace
```

Install a plugin:

```
claude plugin install <plugin-name>@mediainterface
```

## Available plugins

### ado-toolkit

Azure DevOps Server through the Azure CLI: create, show, query, update and comment on work items,
review, create, update and comment on pull requests, analyse failed builds and write changelogs. It
assumes no particular development process, so teams that mostly work on tickets can use it as well
as teams that code; `sdd-kit` builds on it.

| | |
|---|---|
| Install | `claude plugin install ado-toolkit@mediainterface` |
| Type | Skills only |
| Requires | A git checkout of an Azure DevOps repository (its `origin` picks the server and project), the `az` CLI with the `azure-devops` extension, and a sign-in via `az devops login` (PAT) |
| Skills | `/ado-workitem`, `/ado-pr`, `/ado-pipeline` |

### azure-devops (obsolete)

**Obsolete and removed soon — use `ado-toolkit` instead.** The MCP-based predecessor: pipeline
failure analysis, pull request review/creation/update, and changelogs via an MCP server.

| | |
|---|---|
| Install | Do not install anymore — `claude plugin install ado-toolkit@mediainterface` |
| Type | MCP server + skill |
| Requires | `ADO_PAT` env var (Personal Access Token), Node.js v18+ |

### humanizer

Writing editor that identifies and removes AI writing patterns to make text sound more natural and human. Covers 29 pattern categories (significance inflation, promotional language, filler phrases, em dash overuse, and more) based on Wikipedia's "Signs of AI writing" page. Supports optional voice calibration from a writing sample.

| | |
|---|---|
| Install | `claude plugin install humanizer@mediainterface` |
| Type | Skill only |
| Requires | Nothing |
| Source | [blader/humanizer](https://github.com/blader/humanizer) (MIT, Siqi Chen) |

### product-docs

Product documentation in the house form of the MIRA manuals: write a new page under
`docs/product/` or bring an existing one into that form. Facts come from today's code, every
label and message is quoted from the English interface, the text is American English, and each
page takes its reader once through the feature and back to where they started.

| | |
|---|---|
| Install | `claude plugin install product-docs@mediainterface` |
| Type | Skill only |
| Requires | Nothing; `ado-toolkit` optionally, to read the work item |
| Skills | `/product-doc` |

### sdd-kit

Spec-Driven Development toolkit: capture Decision Records and Lessons Learned with guided workflows
and standardized templates (MADR format), write a story's design spec in a compact, decision-centred
form, gate an approved spec into a pull request before any implementation, and review the resulting
pull requests in depth. The Azure DevOps side of delivery — pull requests, work items, and
pipelines/changelogs — comes from `ado-toolkit`, which installs along with `sdd-kit` as its
dependency.

| | |
|---|---|
| Install | `claude plugin install sdd-kit@mediainterface` |
| Type | Skills + SessionStart hook (the spec→PR policy) |
| Requires | The `ado-toolkit` plugin (installed automatically as a dependency). Nothing beyond it for `/create-decision` and `/create-lesson-learned`; `/design-spec` reads the work item via `/ado-workitem`. `/pr-review` and `/spec-pr` on Azure DevOps need what `ado-toolkit` needs (`az` CLI with the `azure-devops` extension, `az devops login`); `/spec-pr` additionally needs the `gh` CLI on GitHub remotes. |
| Skills | `/create-decision`, `/create-lesson-learned`, `/design-spec`, `/spec-pr`, `/pr-review` |

## Adding a plugin

1. Create a directory under `plugins/<your-plugin-name>/`.
2. Add a `.claude-plugin/plugin.json` manifest inside it.
3. Register the plugin in `.claude-plugin/marketplace.json` under the `plugins` array.
4. Open a PR.
