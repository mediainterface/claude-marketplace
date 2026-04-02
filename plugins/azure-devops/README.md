# Azure DevOps Plugin for Claude Code

Claude Code plugin for working with on-premises Azure DevOps Server 2022. Provides pipeline analysis, PR review, PR creation/update, and changelog generation.

## Prerequisites

- **Node.js** (v18+)
- **`ADO_PAT`** environment variable — Azure DevOps Personal Access Token with:
  - Build > Read (pipeline analysis)
  - Code > Read (PR review, changelog)
  - Code > Read & Write (PR creation/update)
- Git repository with an Azure DevOps Server origin remote

## How It Works

The plugin consists of two parts:

- **MCP Server (`ado-mcp`)** — Exposes 5 tools for Azure DevOps REST API access (`ado_get`, `ado_post`, `ado_patch`, `ado_delete`, `parse_ado_remote`). Distributed as an npm tarball via GitHub releases, launched with `npx`.
- **Skill (`azure-devops`)** — Orchestrates workflows (pipeline analysis, PR review, PR creation, PR update, changelog) using the MCP tools.

## Supported Workflows

| Workflow | Trigger |
|----------|---------|
| Pipeline Analysis | Build URL or build ID |
| PR Review | PR URL or PR ID |
| PR Creation | `create` or ask to create a PR |
| PR Update | `update` or ask to update a PR |
| Changelog | `changelog` or ask what changed since a build/commit |

## Configuration

The MCP server reads these environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADO_PAT` | Yes | — | Personal Access Token |
| `ADO_API_VERSION` | No | `7.1` | Azure DevOps REST API version |

## Claude Code Permissions

The plugin uses several Claude Code tools that require user approval. To avoid repeated permission prompts, add the following wildcard rules to your **allowed tools** in `.claude/settings.json` (or the project-level `.claude/settings.local.json`):

```json
{
  "permissions": {
    "allow": [
      "Bash(git branch *)",
      "Bash(git cat-file *)",
      "Bash(git checkout *)",
      "Bash(git diff *)",
      "Bash(git fetch *)",
      "Bash(git log *)",
      "Bash(git remote *)",
      "Bash(git rev-list *)",
      "Bash(git rev-parse *)",
      "Bash(git stash *)",
      "Bash(npx * ado-mcp*)",
      "Read",
      "Glob",
      "Grep",
      "mcp__ado__*"
    ]
  }
}
```

### What each permission covers

| Permission | Why it's needed |
|---|---|
| `Bash(git branch *)` | Detect current branch |
| `Bash(git cat-file *)` | Verify commit existence |
| `Bash(git checkout *)` | Switch to source/build branch for analysis |
| `Bash(git diff *)` | Generate diffs for PR review and changelog |
| `Bash(git fetch *)` | Fetch remote branches and commits |
| `Bash(git log *)` | Collect commit history |
| `Bash(git remote *)` | Read the ADO remote URL |
| `Bash(git rev-list *)` | Count commits between refs |
| `Bash(git rev-parse *)` | Resolve HEAD and refs |
| `Bash(git stash *)` | Stash/restore uncommitted changes during checkout |
| `Bash(npx * ado-mcp*)` | Launching the ado-mcp MCP server |
| `Read` | Reading local files (pipeline YAML, PR templates, source code) |
| `Glob` | Finding files by pattern (PR templates, CLAUDE.md files) |
| `Grep` | Searching code for patterns and conventions |
| `mcp__ado__*` | All five MCP tools (`ado_get`, `ado_post`, `ado_patch`, `ado_delete`, `parse_ado_remote`) |

> **Note:** If you only use read-only workflows (pipeline analysis, PR review, changelog), you can omit `mcp__ado__ado_post`, `mcp__ado__ado_patch`, and `mcp__ado__ado_delete` and use a more restrictive set instead of `mcp__ado__*`.

## Supported ADO URL Format

```
https://{host}/{tfs-path}/{collection}/{project}/_git/{repo}
```

The plugin auto-detects server, collection, project, and repository from the git remote of the current directory.

## License

Apache-2.0
