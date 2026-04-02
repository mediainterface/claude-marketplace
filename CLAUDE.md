# Claude Marketplace

Internal Claude Code plugin marketplace for MediaInterface GmbH.

## Repository Structure

```
├── .claude-plugin/
│   └── marketplace.json          # Marketplace manifest — registry of all plugins
├── .github/workflows/            # CI/CD workflows
│   └── release-ado-mcp.yml      # Build + release the ado-mcp server tarball
├── plugins/
│   └── azure-devops/             # Azure DevOps Server integration plugin
│       ├── .claude-plugin/
│       │   └── plugin.json       # Plugin manifest (name, version, description)
│       ├── .mcp.json             # MCP server config (launched via npx)
│       ├── README.md
│       ├── servers/
│       │   └── ado-mcp/          # TypeScript MCP server (5 tools)
│       └── skills/
│           └── azure-devops/
│               └── SKILL.md      # Skill orchestrating ADO workflows
├── CLAUDE.md
├── README.md
└── LICENSE                       # Apache-2.0
```

## Plugin Conventions

- All plugins go under `plugins/<plugin-name>/` (kebab-case).
- Each plugin must have `.claude-plugin/plugin.json` at minimum (only `name` is required).
- Register every plugin in `.claude-plugin/marketplace.json` under the `plugins` array.
- No dependencies at the marketplace level — only individual plugins have their own.

### Plugin Entry Format (marketplace.json)

```json
{
  "name": "my-plugin",
  "source": "./my-plugin",
  "description": "What the plugin does",
  "version": "1.0.0"
}
```

`source` is relative to `pluginRoot` (`./plugins`).

## Plugins

### azure-devops

Azure DevOps Server integration providing pipeline analysis, PR review/create/update, and changelog generation.

- **MCP Server** (`plugins/azure-devops/servers/ado-mcp/`): TypeScript, exposes `ado_get`, `ado_post`, `ado_patch`, `ado_delete`, `parse_ado_remote`. Distributed as `ado-mcp-latest.tgz` via GitHub releases, fetched at runtime with `npx`.
- **Skill** (`plugins/azure-devops/skills/azure-devops/SKILL.md`): Orchestrates 5 workflows using the MCP tools.
- **Requires** `ADO_PAT` env var (Personal Access Token). Optional `ADO_API_VERSION` (default `7.1`).

## CI/CD

### release-ado-mcp.yml

Triggers on push to `main` when `plugins/azure-devops/servers/ado-mcp/**` changes, or manually via `workflow_dispatch`.

Steps: `npm ci` → `npm run build` → `npm pack` → create GitHub release tagged `ado-mcp-v{version}` with `ado-mcp-latest.tgz` attached (marked `--latest`).

The `.mcp.json` downloads from `releases/latest/download/ado-mcp-latest.tgz` — bumping the version in `package.json` requires no URL changes.
