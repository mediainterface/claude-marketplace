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
│   ├── sdd-kit/                  # Spec-Driven Development toolkit (skills + spec→PR hook)
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json
│   │   ├── hooks/
│   │   │   ├── hooks.json        # SessionStart hook — inject the SDD spec→PR policy
│   │   │   ├── inject-sdd-policy.js  # Node: reads sdd-policy.md → additionalContext
│   │   │   └── sdd-policy.md      # the SDD policy prose injected at SessionStart
│   │   └── skills/
│   │       ├── create-decision/
│   │       │   └── SKILL.md      # /create-decision — document decisions as Decision Records
│   │       ├── create-lesson-learned/
│   │       │   └── SKILL.md      # /create-lesson-learned — capture patterns and pitfalls
│   │       ├── memory-bank-shared/
│   │       │   └── REFERENCE.md  # Shared levels model, placement rule, significance triage (not a skill)
│   │       ├── spec-pr/
│   │       │   └── SKILL.md      # /spec-pr — open a PR for the spec, then stop (no plan/code)
│   │       ├── ado-shared/
│   │       │   └── REFERENCE.md  # Shared ADO setup/auth/command-map (not a skill)
│   │       ├── ado-pr/
│   │       │   └── SKILL.md      # /ado-pr — PR review/create/update/comment via az CLI
│   │       ├── ado-workitem/
│   │       │   └── SKILL.md      # /ado-workitem — German-localized work items via az CLI
│   │       ├── ado-pipeline/
│   │       │   └── SKILL.md      # /ado-pipeline — pipeline analysis + changelog via az CLI
│   │       └── pr-review/
│   │           └── SKILL.md      # /pr-review — deep triage-first ADO PR review in a worktree
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

The skill set for MediaInterface's Spec-Driven Development (SDD) workflow — the skills we rely on across SDD (capturing the decisions and lessons behind a spec, gating the spec into a pull request, reviewing the resulting PRs in depth, and handling the Azure DevOps work — PRs, work items, pipelines — along the way), not a general-purpose collection. It is mostly skills plus one hook (the spec→PR redirect); no MCP server.

**Specs and plans are transient.** A design spec and an implementation plan belong to one story, not to the repository: they are created as before (Refinement → spec PR → `writing-plans` after the merge) and **deleted again at the human code review of the story's implementation PR**, at the latest after the first review round — a round being complete once every required reviewer has *seen* the code, which is not the same as holding a vote: ADO clears votes on a new push, so the evidence can equally be an earlier vote in the PR's system threads or a thread the reviewer opened. Spelling out *which* review is meant is deliberate: Claude reviews its own code constantly while implementing, and a spec PR is never the place — it matches the pattern from the outside (a PR in review with a spec file in it) while being the opposite situation, so the policy names both distinguishing marks: the implementation PR changes production code, and the spec PR is long merged by then. The superpowers plugin (`brainstorming`, `writing-plans`) still writes them to `docs/superpowers/` and commits them — it is a third-party plugin and stays untouched; our SessionStart policy overrides only how long they live. The protection against losing the reasoning sits earlier: while the spec is written, everything needed beyond the user story and the spec has to be captured **outside** the spec — inline in the code as its own reason, in the user story, in a `.claude/rules/` convention, or as a Decision Record / Lesson Learned in the Memory Bank. The check at code review only confirms it. This runs through the whole plugin: `hooks/sdd-policy.md` (capture duty + deletion step), `/spec-pr` (Step 3), `/pr-review` (dimension 5), and `skills/memory-bank-shared/REFERENCE.md` (the spec is not a storage location).

- **Skill** (`plugins/sdd-kit/skills/create-decision/SKILL.md`): `/create-decision` — documents decisions in the Memory Bank as Decision Records, named `docs/decisions/YYYY-MM-DD-<title>.md` (date-based like learnings, so parallel branches don't collide on a "next number"; legacy `NNNN-…` records coexist and are never renamed). Applies a **hard significance gate** (record only on structural impact, hard-to-reverse, precedent, or cross-cutting — otherwise routes to a convention, a learning, or an inline reason in the code — never to the spec, which does not survive the story) and places the record on the right **Memory Bank level** (`docs/decisions/` of the smallest directory subtree containing everyone affected — repo root, `apps/<app>/`, `services/<service>/`, …). Gate, placement rule, and delta principle live in `skills/memory-bank-shared/REFERENCE.md` (a non-skill shared reference, pattern as `ado-shared`).
- **Skill** (`plugins/sdd-kit/skills/create-lesson-learned/SKILL.md`): `/create-lesson-learned` — captures recurring patterns and pitfalls in the Memory Bank, placed on the right Memory Bank level like decisions (no significance gate — learnings stay deliberately low-threshold).
- **Skill** (`plugins/sdd-kit/skills/spec-pr/SKILL.md`): `/spec-pr` — the SDD replacement for the superpowers brainstorming skill's `writing-plans` handoff. After a spec is written and approved, it opens a pull request for the spec (offering to bundle Memory Bank items via `/create-decision` and `/create-lesson-learned` into the same PR) and then **stops** — no implementation plan, no code — until the PR is merged. Because the spec is transient (see above), the skill names that fact to the user and its **Step 3** is the capture check: everything in the spec that is needed beyond this story gets a durable home first — a routing table maps each kind of content to exactly one place (inline code reason, work item, `.claude/rules/` convention, Decision Record, Lesson Learned). Auto-detects the remote: Azure DevOps → the `/ado-pr` creation workflow (shared title schema, **📝 spec-only** marker, linked work item required as on any ADO PR); GitHub → the `gh` CLI. Invokable manually, or triggered automatically by the hook below.
- **Hook** (`plugins/sdd-kit/hooks/hooks.json` + `hooks/inject-sdd-policy.js` + `hooks/sdd-policy.md`): a `type: "command"` **SessionStart** hook (matcher `startup|clear|compact`, mirroring superpowers). The `Skill` tool is not hookable, so rather than intercept the handoff we override it at the same layer superpowers uses to deliver it: the **Node** script reads the policy prose from `hooks/sdd-policy.md` and emits it as `hookSpecificOutput.additionalContext` — no detection logic in the script itself. The SDD workflow is MediaInterface-internal, so the policy prose opens with an **applicability section** that Claude evaluates itself when the policy first becomes relevant: git origin on `ado.mediainterface.de` (any URL form; the collection doesn't matter) → in force; any other origin → **ask the user once** before following the workflow; no git repo or no origin → does not apply, no question asked. The policy has two parts: (1) after a spec is approved, override the brainstorming skill's `writing-plans` handoff and route to `/spec-pr` (open the spec PR and stop) unless the user explicitly asks for a plan, flagging a referenced ticket that is not in the **Refinement** state, and require that everything needed beyond the story and the spec is captured outside the spec before the spec PR is opened (the four durable homes, since the spec does not survive); and (2) during implementation, when a user story is referenced, flag it if it is not in the **Implementation** state; explicitly do **not** create ADO tasks for the plan's todo items (neither automatically nor by offering it; plan steps add no value as work items for human readers — this replaced the earlier plan-steps→tasks flow); and **delete the spec and the plan at the code review** — a step of its own, deliberately coupled to nothing else: counter-check that nothing durable lives only there, then `git rm` spec and plan into the branch under review, never touching records or conventions. Which review that is gets nailed down in the prose, because "code review" is otherwise something Claude does to its own code every few minutes: the **human** review of the **implementation** PR, never a self-started `/code-review` or `/pr-review` run and never a spec PR, with a round complete once every `isRequired` reviewer has seen the code once — evidenced by a current vote, an earlier one from the PR's system threads, or a thread they opened, because ADO clears votes on every new push. The policy prose also carries a compact **Memory Bank records: significance & placement** section — the four significance criteria plus the smallest-covering-level placement rule — so record proposals are filtered at session level, before any skill is invoked. The prose lives in its own file so it can grow without touching the script; `compact` re-injection keeps it present across long sessions.
- **Azure DevOps skills** (`plugins/sdd-kit/skills/ado-pr`, `ado-workitem`, `ado-pipeline`): Azure DevOps via the Azure CLI (`az` + azure-devops extension), split into `/ado-pr` (PR review/create/update/comment), `/ado-workitem` (work item create/show/query/update), and `/ado-pipeline` (pipeline-failure analysis + changelog), for the newest Azure DevOps Server version. Shared connection detection, sign-in check, command map, title schema, quirks, and error-handling live in `skills/ado-shared/REFERENCE.md` — a non-skill file the three SKILL.md files link to by relative path. The title schema gives PR titles the shape `<Marker> #<WorkItemId> <Component/Application> - <Beschreibung>` (change-category emoji incl. 📝 for spec-only PRs), while work item titles are just the concise German description (the parent type/ID/component prefix was dropped as too long). They assume the user is already signed in via `az devops login` (PAT-based); they never authenticate themselves and prompt the user if sign-in is missing. The Server is **German-localized**, so work item types/states are German (e.g. `Aufgabe`, not `Task`) — fetched from the server rather than assumed — and all German text sent to ADO keeps its real umlauts/ß (never transliterated to `ue`/`oe`/`ae`/`ss`), a rule spelled out in the shared reference's **German text** section. The MCP-based `azure-devops` plugin stays for the older Server version.
- **Skill** (`plugins/sdd-kit/skills/pr-review/SKILL.md`): `/pr-review <PR_ID_OR_URL>` — the deep, **triage-first** review of an Azure DevOps PR (the counterpart to the quick working-tree `/code-review`). It checks the PR branch out in an **isolated worktree** (`.claude/worktrees/pr-review-<id>`, never the user's checkout), then dispatches **one read-only subagent per dimension** (`Explore`-type, explicit `model: sonnet` — a skill's `allowed-tools` is not inherited, so the read-only guarantee has to live in the subagent's own tool set): security, CI/pipeline status, consistency & drift (duplicate/divergent implementations, dead code, component-library usage, `.sln` platform configs), code smells & correctness, **ADR compliance**, **test protection** (would the test fail if the behavior were wrong?), and **test surplus** (what could be deleted?) — the last two deliberately as *separate* dispatches, because one reviewer holding both jobs always reports the gap and drops the surplus. Two hard rules: review and posting are separate phases (the review is read-only and ends in a report), and the user's checkout is never touched. Findings are reported as a **numbered list** grouped 🔴/🟡/🟢, each entry starting with `**[N]**` and never `N.` (the terminal Markdown renderer would add its own counter and restart it), with a non-postable **status header** for CI results and the test-to-production line ratio, and are posted only for the numbers the user names, via `/ado-pr`'s *PR Comments* workflow, anchored at `file:line`. Comments follow an **ELI5 recipe** — German, informal „du", everyday words, at most three sentences — binding from the moment a subagent writes a finding, not only at posting time. The ADR dimension reads decision records from **every Memory Bank level** above the changed paths and applies the shared **significance triage** before proposing a missing record; it also carries the **spec/plan counter-check** — this review is where the story's spec and plan are removed, so it first flags reasoning that lives only in them (🟡, anchored at the code it concerns) and then the undeleted files themselves (🟢, 🟡 past the first review round, judged from three signals per `isRequired` reviewer — current vote, earlier vote in the system threads, own comment threads — since a reset vote does not undo a review that happened; a `/pr-review` run is never one of the signals). Phase A therefore keeps the system threads instead of dropping them, excluding them from the dedupe only. On a **spec PR** the check is skipped in Phase C and never reaches the dimension; the ADO plumbing comes from `/ado-pr` and `/ado-pipeline`, `skills/ado-shared/REFERENCE.md` and `skills/memory-bank-shared/REFERENCE.md` by relative path.
- **Requires** the `az` CLI with the `azure-devops` extension installed and the user signed in via `az devops login` for the `/ado-pr`, `/ado-workitem`, `/ado-pipeline`, and `/pr-review` skills. `/spec-pr` reuses that ADO setup for Azure DevOps remotes and needs the `gh` CLI (authenticated) when the remote is GitHub.

### guardian

Tools for the guardians (the Hüter-Trio) to do their job. The guardians watch over the whole repository and its architecture — the Memory Bank included — reviewing changes on a scheduled basis (everything since their last meeting) and guarding against contradictory or nonsensical records and architectural drift. Skill-only so far; it will grow.

- **Skill** (`plugins/guardian/skills/memory-bank-changes/SKILL.md`): `/memory-bank-changes [since]` — reports every Memory Bank change since a date (default the last 7 days) so a guardian can trace **what changed, by whom, and why**. It reconstructs the timeline from **git history** (author, date, commit message, added/modified/deleted/renamed files) and enriches each touched record with its **content** (title, category, status, deciders, a short reasoning summary, and status transitions such as `Active → Resolved`). Covers all three Memory Bank artifacts — Decision Records and Lessons Learned in every `docs/decisions/` / `docs/learnings/` directory on any Memory Bank level (repo root or nested, e.g. `apps/<app>/docs/decisions/`), and Conventions (Claude Code Rules in `.claude/rules/`) — the same locations `sdd-kit`'s `/create-decision` and `/create-lesson-learned` write to; it also flags suspected level misplacements. Output is a scannable terminal report grouped by artifact type with a guardian-flags callout (e.g. a *deleted* decision, since decisions are only ever superseded); the report is ephemeral — printed, not written into the repo — unless the user explicitly asks to save it to a path they name. Read-only, works offline (pure `git` + file reads), and always runs against the repo of the **current working directory** — run it once per project repo.
- **Requires** the Memory Bank to live in a git repository (it always does). No env vars, external services, or extra CLIs.

## CI/CD

### release-ado-mcp.yml

Triggers on push to `main` when `plugins/azure-devops/servers/ado-mcp/**` changes, or manually via `workflow_dispatch`.

Steps: `npm ci` → `npm run build` → `npm pack` → create GitHub release tagged `ado-mcp-v{version}` with `ado-mcp-latest.tgz` attached (marked `--latest`).

The `.mcp.json` downloads from `releases/latest/download/ado-mcp-latest.tgz` — bumping the version in `package.json` requires no URL changes.
