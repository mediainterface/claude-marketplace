# claude-md-improver

PreToolUse hook that keeps `CLAUDE.md` files in sync with staged changes before each `git commit`.

## How it works

The plugin registers a single PreToolUse hook matching `Bash(git commit:*)`. Right before any `git commit` runs, the hook:

1. Checks that there are staged changes (otherwise exits silently).
2. Finds all `CLAUDE.md` files in the repository (excluding `.claude/`, `node_modules/`, and `.worktrees/`).
3. Invokes `claude -p` in print mode with the staged diff and asks it to update the affected `CLAUDE.md` files **only** when documented architecture, conventions, commands, prerequisites, project structure, or skill descriptions are affected.
4. Stages any edited `CLAUDE.md` so they land in the same commit.

Trivial changes (bug fixes, formatting, tests) are intentionally skipped.

## Prerequisites

- `claude` CLI on `PATH` — the hook runs `claude -p --model claude-sonnet-4-6 --max-turns 3 ...`.
- The hook runs against the repository at the current working directory, so it does nothing outside a git repo.

## Configuration

No configuration. Install the plugin and the hook fires automatically on every `git commit` invoked through the `Bash` tool.

## Notes

This hook works around [anthropics/claude-code#22637](https://github.com/anthropics/claude-code/issues/22637) by using a plain bash hook with a `claude -p` subprocess instead of the agent hook type.
