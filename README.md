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

### azure-devops

Azure DevOps Server integration for on-premises ADO instances. Provides pipeline failure analysis, pull request review/creation/update, and changelog generation since a given build or commit.

| | |
|---|---|
| Install | `claude plugin install azure-devops@mediainterface` |
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

## Adding a plugin

1. Create a directory under `plugins/<your-plugin-name>/`.
2. Add a `.claude-plugin/plugin.json` manifest inside it.
3. Register the plugin in `.claude-plugin/marketplace.json` under the `plugins` array.
4. Open a PR.
