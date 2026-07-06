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
│   ├── sdd-kit/                  # Spec-Driven Development toolkit (skill-only)
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json
│   │   └── skills/
│   │       ├── create-decision/
│   │       │   └── SKILL.md      # /create-decision — document decisions as Decision Records
│   │       ├── create-lesson-learned/
│   │       │   └── SKILL.md      # /create-lesson-learned — capture patterns and pitfalls
│   │       ├── ado-shared/
│   │       │   └── REFERENCE.md  # Shared ADO setup/auth/command-map (not a skill)
│   │       ├── ado-pr/
│   │       │   └── SKILL.md      # /ado-pr — PR review/create/update/comment via az CLI
│   │       ├── ado-workitem/
│   │       │   └── SKILL.md      # /ado-workitem — German-localized work items via az CLI
│   │       └── ado-pipeline/
│   │           └── SKILL.md      # /ado-pipeline — pipeline analysis + changelog via az CLI
│   └── guardian/                 # Guardian (Hüter-Trio) tooling (skill-only)
│       ├── .claude-plugin/
│       │   └── plugin.json
│       ├── README.md
│       └── skills/
│           └── memory-bank-changes/
│               └── SKILL.md      # /memory-bank-changes — report Memory Bank changes since a date, by whom and why
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
- **Azure DevOps skills** (`plugins/sdd-kit/skills/ado-pr`, `ado-workitem`, `ado-pipeline`): Azure DevOps via the Azure CLI (`az` + azure-devops extension), split into `/ado-pr` (PR review/create/update/comment), `/ado-workitem` (work item create/show/query/update), and `/ado-pipeline` (pipeline-failure analysis + changelog), for the newest Azure DevOps Server version. Shared connection detection, sign-in check, command map, title schema, quirks, and error-handling live in `skills/ado-shared/REFERENCE.md` — a non-skill file the three SKILL.md files link to by relative path. The shared title schema (`<Marker> #<ID> <Component/Application> - <Beschreibung>`) keeps PR titles (change-category emoji incl. 📝 for spec-only PRs) and work item titles (parent's type word + parent ID) consistent. They assume the user is already signed in via `az devops login` (PAT-based); they never authenticate themselves and prompt the user if sign-in is missing. The Server is **German-localized**, so work item types/states are German (e.g. `Aufgabe`, not `Task`) — fetched from the server rather than assumed. The MCP-based `azure-devops` plugin stays for the older Server version.
- **Requires** the `az` CLI with the `azure-devops` extension installed and the user signed in via `az devops login` for the `/ado-pr`, `/ado-workitem`, and `/ado-pipeline` skills.

### guardian

Tools for the guardians (the Hüter-Trio) to do their job. The guardians watch over the whole repository and its architecture — the Memory Bank included — reviewing changes on a scheduled basis (everything since their last meeting) and guarding against contradictory or nonsensical records and architectural drift. Skill-only so far; it will grow.

- **Skill** (`plugins/guardian/skills/memory-bank-changes/SKILL.md`): `/memory-bank-changes [since]` — reports every Memory Bank change since a date (default the last 7 days) so a guardian can trace **what changed, by whom, and why**. It reconstructs the timeline from **git history** (author, date, commit message, added/modified/deleted/renamed files) and enriches each touched record with its **content** (title, category, status, deciders, a short reasoning summary, and status transitions such as `Active → Resolved`). Covers all three Memory Bank artifacts — Decision Records (`docs/decisions/`), Lessons Learned (`docs/learnings/`), and Conventions (Claude Code Rules in `.claude/rules/`) — the same locations `sdd-kit`'s `/create-decision` and `/create-lesson-learned` write to. Output is a scannable terminal report grouped by artifact type with a guardian-flags callout (e.g. a *deleted* decision, since decisions are only ever superseded), and it offers to save the report to `docs/guardian-review-YYYY-MM-DD.md`. Read-only, works offline (pure `git` + file reads), and always runs against the repo of the **current working directory** — run it once per project repo.
- **Requires** the Memory Bank to live in a git repository (it always does). No env vars, external services, or extra CLIs.

## CI/CD

### release-ado-mcp.yml

Triggers on push to `main` when `plugins/azure-devops/servers/ado-mcp/**` changes, or manually via `workflow_dispatch`.

Steps: `npm ci` → `npm run build` → `npm pack` → create GitHub release tagged `ado-mcp-v{version}` with `ado-mcp-latest.tgz` attached (marked `--latest`).

The `.mcp.json` downloads from `releases/latest/download/ado-mcp-latest.tgz` — bumping the version in `package.json` requires no URL changes.
