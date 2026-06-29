# Claude Marketplace

Internal Claude Code plugin marketplace for MediaInterface GmbH.

## Repository Structure

```
├── .claude-plugin/
│   └── marketplace.json          # Marketplace manifest — registry of all plugins
├── .github/workflows/            # CI/CD workflows
│   └── release-ado-mcp.yml      # Build + release the ado-mcp server tarball
├── plugins/
│   ├── azure-devops/             # Azure DevOps Server integration plugin
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json       # Plugin manifest (name, version, description)
│   │   ├── .mcp.json             # MCP server config (launched via npx)
│   │   ├── README.md
│   │   ├── servers/
│   │   │   └── ado-mcp/          # TypeScript MCP server (5 tools)
│   │   └── skills/
│   │       └── azure-devops/
│   │           └── SKILL.md      # Skill orchestrating ADO workflows
│   ├── humanizer/                # AI writing pattern removal skill
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json
│   │   ├── LICENSE               # MIT (upstream: blader/humanizer)
│   │   ├── README.md
│   │   └── skills/
│   │       └── humanizer/
│   │           └── SKILL.md      # Writing editor skill (29 pattern categories)
│   ├── claude-md-improver/       # PreToolUse hook syncing CLAUDE.md on git commit
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json
│   │   ├── README.md
│   │   └── hooks/
│   │       └── hooks.json        # Agent hook config (PreToolUse on Bash(git commit:*))
│   └── sdd-kit/                  # Spec-Driven Development toolkit (skill-only)
│       ├── .claude-plugin/
│       │   └── plugin.json
│       └── skills/
│           ├── create-decision/
│           │   └── SKILL.md      # /create-decision — document decisions as Decision Records
│           ├── create-lesson-learned/
│           │   └── SKILL.md      # /create-lesson-learned — capture patterns and pitfalls
│           └── ado-cli/
│               └── SKILL.md      # /ado-cli — Azure DevOps via az CLI (newest Server, PAT auth)
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
  "source": "./plugins/my-plugin",
  "description": "What the plugin does",
  "version": "1.0.0"
}
```

`source` is relative to the repository root.

## Plugins

### azure-devops

Azure DevOps Server integration providing pipeline analysis, PR review/create/update, and changelog generation.

- **MCP Server** (`plugins/azure-devops/servers/ado-mcp/`): TypeScript, exposes `ado_get`, `ado_post`, `ado_patch`, `ado_delete`, `parse_ado_remote`. Distributed as `ado-mcp-latest.tgz` via GitHub releases, fetched at runtime with `npx`.
- **Skill** (`plugins/azure-devops/skills/azure-devops/SKILL.md`): Orchestrates 5 workflows using the MCP tools.
- **Requires** `ADO_PAT` env var (Personal Access Token). Optional `ADO_API_VERSION` (default `7.1`).

### humanizer

Writing editor skill that identifies and removes AI writing patterns. Based on [Wikipedia's "Signs of AI writing"](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing). Skill-only plugin (no MCP server).

- **Skill** (`plugins/humanizer/skills/humanizer/SKILL.md`): Detects 29 AI writing pattern categories and rewrites text to sound natural.
- **Source**: [github.com/blader/humanizer](https://github.com/blader/humanizer)
- **No external dependencies or env vars required.**

### claude-md-improver

Hook-only plugin that keeps `CLAUDE.md` files in sync with staged changes before each `git commit`.

- **Hook** (`plugins/claude-md-improver/hooks/hooks.json`): `type: "agent"` PreToolUse hook matching `Bash(git commit:*)`, running Sonnet 4.6 inline against the staged diff and updating affected `CLAUDE.md` files (architecture, conventions, commands, prerequisites, project structure, or skill descriptions only). Always returns `permissionDecision: allow`.
- **Requires** Claude Code 2.1.118+ (agent hook support). No env vars or external CLI.

### sdd-kit

The skill set for MediaInterface's Spec-Driven Development (SDD) workflow — the skills we rely on across SDD (capturing the decisions and lessons behind a spec, then running the Azure DevOps work a plan turns into), not a general-purpose collection. So far it contains only skills; no hooks or MCP server have been added yet.

- **Skill** (`plugins/sdd-kit/skills/create-decision/SKILL.md`): `/create-decision` — documents decisions in the Memory Bank as Decision Records.
- **Skill** (`plugins/sdd-kit/skills/create-lesson-learned/SKILL.md`): `/create-lesson-learned` — captures recurring patterns and pitfalls in the Memory Bank.
- **Skill** (`plugins/sdd-kit/skills/ado-cli/SKILL.md`): `/ado-cli` — Azure DevOps via the Azure CLI (`az` + azure-devops extension). Covers seven workflows (pipeline analysis, PR review/create/update, PR comments, changelog, and work item management) for the newest Azure DevOps Server version. Assumes the user is already signed in to Azure DevOps via `az devops login` (PAT-based) — it never authenticates itself and prompts the user if sign-in is missing. The Server is **German-localized**, so work item types/states are German (e.g. `Aufgabe`, not `Task`) — the skill fetches them from the server rather than assuming. The MCP-based `azure-devops` plugin stays for the older Server version.
- **Requires** the `az` CLI with the `azure-devops` extension installed and the user signed in via `az devops login` for `/ado-cli`.

## CI/CD

### release-ado-mcp.yml

Triggers on push to `main` when `plugins/azure-devops/servers/ado-mcp/**` changes, or manually via `workflow_dispatch`.

Steps: `npm ci` → `npm run build` → `npm pack` → create GitHub release tagged `ado-mcp-v{version}` with `ado-mcp-latest.tgz` attached (marked `--latest`).

The `.mcp.json` downloads from `releases/latest/download/ado-mcp-latest.tgz` — bumping the version in `package.json` requires no URL changes.
