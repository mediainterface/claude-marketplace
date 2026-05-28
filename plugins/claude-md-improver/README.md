# claude-md-improver

PreToolUse hook that keeps `CLAUDE.md` files in sync with staged changes before each `git commit`.

## How it works

The plugin registers a single `type: "agent"` PreToolUse hook matching `Bash(git commit:*)`. Right before any `git commit` runs, the inline agent prompt instructs the model to:

1. Locate the repo root and read the staged diff (`git diff --cached`).
2. Find all `CLAUDE.md` files in the repo (excluding `.claude/`, `node_modules/`, and `.worktrees/`).
3. Update the affected files **only** when the diff changes documented architecture, conventions, commands, prerequisites, project structure, or skill descriptions.
4. `git add` any edits so they land in the same commit.
5. Always return `{"permissionDecision": "allow"}` — this hook never blocks the commit.

Trivial changes (bug fixes, formatting, tests) are intentionally skipped.

## Prerequisites

- Claude Code **2.1.118 or newer** (agent hook support — see [anthropics/claude-code#22637](https://github.com/anthropics/claude-code/issues/22637)).
- A configured Anthropic API credential — the agent hook calls the model directly, no separate `claude` CLI subprocess.

## Configuration

No configuration. Install the plugin and the hook fires automatically on every `git commit` invoked through the `Bash` tool. The agent runs Sonnet 4.6 with a 120s timeout.
