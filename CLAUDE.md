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
│   └── sdd-kit/                  # Spec-Driven Development toolkit (skills + spec→PR hook)
│       ├── .claude-plugin/
│       │   └── plugin.json
│       ├── hooks/
│       │   ├── hooks.json        # SessionStart hook — inject the SDD spec→PR policy
│       │   ├── inject-sdd-policy.js  # Node: reads sdd-policy.md → additionalContext
│       │   └── sdd-policy.md      # the SDD policy prose injected at SessionStart
│       └── skills/
│           ├── create-decision/
│           │   └── SKILL.md      # /create-decision — document decisions as Decision Records
│           ├── create-lesson-learned/
│           │   └── SKILL.md      # /create-lesson-learned — capture patterns and pitfalls
│           ├── spec-pr/
│           │   └── SKILL.md      # /spec-pr — open a PR for the spec, then stop (no plan/code)
│           ├── ado-shared/
│           │   └── REFERENCE.md  # Shared ADO setup/auth/command-map (not a skill)
│           ├── ado-pr/
│           │   └── SKILL.md      # /ado-pr — PR review/create/update/comment via az CLI
│           ├── ado-workitem/
│           │   └── SKILL.md      # /ado-workitem — German-localized work items via az CLI
│           └── ado-pipeline/
│               └── SKILL.md      # /ado-pipeline — pipeline analysis + changelog via az CLI
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

The skill set for MediaInterface's Spec-Driven Development (SDD) workflow — the skills we rely on across SDD (capturing the decisions and lessons behind a spec, gating the spec into a pull request, then running the Azure DevOps work a plan turns into), not a general-purpose collection. It is mostly skills plus one hook (the spec→PR redirect); no MCP server.

- **Skill** (`plugins/sdd-kit/skills/create-decision/SKILL.md`): `/create-decision` — documents decisions in the Memory Bank as Decision Records.
- **Skill** (`plugins/sdd-kit/skills/create-lesson-learned/SKILL.md`): `/create-lesson-learned` — captures recurring patterns and pitfalls in the Memory Bank.
- **Skill** (`plugins/sdd-kit/skills/spec-pr/SKILL.md`): `/spec-pr` — the SDD replacement for the superpowers brainstorming skill's `writing-plans` handoff. After a spec is written and approved, it opens a pull request for the spec (offering to bundle Memory Bank items via `/create-decision` and `/create-lesson-learned` into the same PR) and then **stops** — no implementation plan, no code — until the PR is merged. Auto-detects the remote: Azure DevOps → the `/ado-pr` creation workflow (shared title schema, **📝 spec-only** marker, work item optional); GitHub → the `gh` CLI. Invokable manually, or triggered automatically by the hook below.
- **Hook** (`plugins/sdd-kit/hooks/hooks.json` + `hooks/inject-sdd-policy.js` + `hooks/sdd-policy.md`): a `type: "command"` **SessionStart** hook (matcher `startup|clear|compact`, mirroring superpowers). The `Skill` tool is not hookable, so rather than intercept the handoff we override it at the same layer superpowers uses to deliver it: the **Node** script reads the policy prose from `hooks/sdd-policy.md` and emits it as `hookSpecificOutput.additionalContext`. The policy has two parts: (1) after a spec is approved, override the brainstorming skill's `writing-plans` handoff and route to `/spec-pr` (open the spec PR and stop) unless the user explicitly asks for a plan; and (2) during implementation, when a user story is referenced, create ADO tasks via `/ado-workitem` for the approved plan's todo items — after an explicit confirmation that states the target user story — with each task's Area/Iteration set to the authenticated user's team, driving each through its state lifecycle (active on start, closed on completion), and resetting the tasks' Area/Iteration to the project root once the story is finished. The prose lives in its own file so it can grow without touching the script; `compact` re-injection keeps it present across long sessions.
- **Azure DevOps skills** (`plugins/sdd-kit/skills/ado-pr`, `ado-workitem`, `ado-pipeline`): Azure DevOps via the Azure CLI (`az` + azure-devops extension), split into `/ado-pr` (PR review/create/update/comment), `/ado-workitem` (work item create/show/query/update), and `/ado-pipeline` (pipeline-failure analysis + changelog), for the newest Azure DevOps Server version. Shared connection detection, sign-in check, command map, title schema, quirks, and error-handling live in `skills/ado-shared/REFERENCE.md` — a non-skill file the three SKILL.md files link to by relative path. The shared title schema (`<Marker> #<ID> <Component/Application> - <Beschreibung>`) keeps PR titles (change-category emoji incl. 📝 for spec-only PRs) and work item titles (parent's type word + parent ID) consistent. They assume the user is already signed in via `az devops login` (PAT-based); they never authenticate themselves and prompt the user if sign-in is missing. The Server is **German-localized**, so work item types/states are German (e.g. `Aufgabe`, not `Task`) — fetched from the server rather than assumed. The MCP-based `azure-devops` plugin stays for the older Server version.
- **Requires** the `az` CLI with the `azure-devops` extension installed and the user signed in via `az devops login` for the `/ado-pr`, `/ado-workitem`, and `/ado-pipeline` skills. `/spec-pr` reuses that ADO setup for Azure DevOps remotes and needs the `gh` CLI (authenticated) when the remote is GitHub.

## CI/CD

### release-ado-mcp.yml

Triggers on push to `main` when `plugins/azure-devops/servers/ado-mcp/**` changes, or manually via `workflow_dispatch`.

Steps: `npm ci` → `npm run build` → `npm pack` → create GitHub release tagged `ado-mcp-v{version}` with `ado-mcp-latest.tgz` attached (marked `--latest`).

The `.mcp.json` downloads from `releases/latest/download/ado-mcp-latest.tgz` — bumping the version in `package.json` requires no URL changes.
