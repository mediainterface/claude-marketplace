# Claude Marketplace

Internal Claude Code plugin marketplace of MediaInterface GmbH (`mediainterface`). Each plugin is a
directory under `plugins/`, registered in `.claude-plugin/marketplace.json`. Users install with
`claude plugin install <plugin>@mediainterface`; what a plugin does for them is in its README.

## Commands

```bash
claude plugin validate .                    # marketplace + all entries (see Pitfalls: one known error)
claude plugin validate plugins/<plugin>     # one plugin
claude --plugin-dir plugins/ado-toolkit --plugin-dir plugins/sdd-kit   # try local copies in a session
echo '{}' | node plugins/sdd-kit/hooks/inject-sdd-policy.js           # print the SDD SessionStart payload
```

The repo has no build or test suite for skills. The only build is the obsolete `ado-mcp` server
(`plugins/azure-devops/servers/ado-mcp`: `npm ci && npm run build`), released by
`.github/workflows/release-ado-mcp.yml` on push to `main`.

## Plugins

| Plugin | Type | Notes |
|---|---|---|
| `ado-toolkit` | Skills | Azure DevOps via the `az` CLI (`/ado-pr`, `/ado-workitem`, `/ado-pipeline`). Process-neutral, for every team. Rule: `.claude/rules/ado-toolkit.md` |
| `sdd-kit` | Skills + SessionStart hook | Spec-Driven Development (`/design-spec`, `/spec-pr`, `/pr-review`, `/create-decision`, `/create-lesson-learned`). Depends on `ado-toolkit`. Rule: `.claude/rules/sdd-kit.md` |
| `guardian` | Skill | `/memory-bank-changes` for the Hüter-Trio |
| `humanizer` | Skill | Vendored from `blader/humanizer` (MIT) |
| `mira-docs` | Skill | `/mira-product-doc`: pages of a `docs/product/` tree; the repository's own documentation rules win |
| `claude-md-improver` | Agent hook | PreToolUse on `Bash(git commit:*)`: keeps `CLAUDE.md` files accurate and lean for the staged diff |
| `azure-devops` | MCP server + skill | **Obsolete**, superseded by `ado-toolkit`; to be removed |

Layout of a plugin: `.claude-plugin/plugin.json` (only `name` is required), then
`skills/<skill>/SKILL.md`, `hooks/hooks.json`, `.mcp.json` as needed, plus a `README.md`. A
directory under `skills/` without a `SKILL.md` (`ado-shared/`, `memory-bank-shared/`,
`sdd-pr-shared/`) holds a shared `REFERENCE.md` that the skills of the same plugin link to by
relative path.

## Conventions

**Manifests and versions**
- Register every plugin in `marketplace.json` (`name`, `source: "./plugins/<name>"`, `description`,
  `version`). Keep `version` equal in the entry and in `plugin.json`.
- Bump the version with every change that should reach users — installed copies are cached per
  version, so an unchanged version is never updated. Patch: wording, fixes. Minor: new behavior
  or skill. Major: a skill removed or renamed, or new prerequisites.
- Plugin names never start with `claude-`, `anthropic-` or `cc-plugin-` (reserved).
- Renaming or removing a plugin: add `"renames": {"<old>": "<new>" | null}` at the top level of
  `marketplace.json` (append-only); optionally `forceRemoveDeletedPlugins: true` to uninstall
  removed plugins on users' machines.

**Between plugins**
- A plugin that builds on another declares it in `plugin.json`: `"dependencies": ["<plugin>"]`
  (bare name = this marketplace). Claude Code installs it along; existing users get it after the
  update plus `/reload-plugins`.
- Never link into another plugin's files by relative path: installed plugins live in separate,
  versioned cache directories. Invoke the other plugin's skill by its namespaced name
  (`ado-toolkit:ado-pr`); it brings its own references along.

**Writing**
- Skill, rule and policy prose is English. German only where it is quoted or sent as is: field
  and section names on the ADO server, PR and work item texts, comment wording.
- Markdown files are hard-wrapped at **100 characters** at word boundaries — `CLAUDE.md`,
  `.claude/rules/`, `SKILL.md`, `REFERENCE.md`, READMEs, the policy prose. Table rows, code
  blocks, frontmatter values and long URLs stay unwrapped. Wrap the paragraphs you edit; never
  reflow a whole file in a change that also carries content. Text sent *to* ADO is never wrapped.
- Commits and PRs in German with gitmoji and a conventional prefix:
  `✨ feat(<plugin>): <was sich ändert>`. PR body: `## Warum`, `## Was sich ändert`, last line
  the version changes.

**This file**
- Stays under 200 lines and holds only what every session needs. No skill descriptions — those
  live in each `SKILL.md` frontmatter and the plugin READMEs. Knowledge needed only when working
  on one plugin goes into a path-scoped rule `.claude/rules/<plugin>.md` — and only what none of
  the plugin's own files states (which files must change together, deliberate boundaries).
  Never restate a skill there; the agent reads the skill anyway.

## Pitfalls

- `claude plugin validate .` reports one known error: `claude-md-improver` uses the reserved
  `claude-` prefix. Renaming it needs a `renames` entry; until then the error is expected.
- `humanizer` stays comparable to upstream: never reformat or edit its `SKILL.md` body. The
  `name` + `description` frontmatter (with explicit triggers and what it must *not* fire on) is
  the one deliberate deviation.
- `claude-md-improver` keeps its whole behavior in the agent prompt in `hooks/hooks.json`
  (needs Claude Code 2.1.118+). It is the main writer of `CLAUDE.md` files across our repos, so
  the rules of *This file* above (lean, bullets, under 200 lines, no skill descriptions) and the
  100-character wrap are spelled out there too — change them in both places.
- `azure-devops` is obsolete; keep its notices (marketplace entry, `plugin.json`, README, skill)
  until removal. Removal: delete `plugins/azure-devops/` and `release-ado-mcp.yml`, drop the
  entry, add `"azure-devops": null` to `renames`.
- `guardian`'s `/memory-bank-changes` reads the locations `sdd-kit` writes the Memory Bank to
  (`docs/decisions/`, `docs/learnings/` on every level, `.claude/rules/`). Moving those in
  `sdd-kit` means updating it too.
- Claude Code worktrees land in `.claude/worktrees/`, which is not ignored — never stage it.
