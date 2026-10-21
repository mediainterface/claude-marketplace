# claude-md-improver

PreToolUse hook that keeps `CLAUDE.md` files in sync with staged changes before each `git commit`.

## How it works

The plugin registers a single `type: "agent"` PreToolUse hook matching `Bash(git commit:*)`.
Right before any `git commit` runs, the inline agent prompt instructs the model to:

1. Locate the repo root and read the staged diff (`git diff --cached`).
2. Find all `CLAUDE.md` files in the repo (excluding `.claude/`, `node_modules/`, and
   `.worktrees/`). Rules under `.claude/` stay untouched — in many repos they are team
   conventions with their own review.
3. Update a file **only** when the diff makes something in it wrong, or leaves out something
   every session there needs: commands, project structure, conventions, prerequisites,
   pitfalls. What a skill or feature does is not documented here.
4. Keep the files lean: correct or delete lines before adding any, short bullets instead of
   prose, no rationale or history, under 200 lines per file. Something that matters only in
   one subdirectory goes into that subdirectory's existing `CLAUDE.md` or is left out. A
   `CLAUDE.md` that states rules about its own scope is followed.
5. Hard-wrap what it writes at 100 characters, without reflowing untouched paragraphs.
6. `git add` any edits so they land in the same commit.
7. Always return `{"permissionDecision": "allow"}` — this hook never blocks the commit.

Trivial changes (bug fixes, formatting, tests) are intentionally skipped. The 200-line target
follows Anthropic's guidance for `CLAUDE.md` files: longer files cost context and lower
adherence.

## Prerequisites

- Claude Code **2.1.118 or newer** (agent hook support — see [anthropics/claude-code#22637](https://github.com/anthropics/claude-code/issues/22637)).
- A configured Anthropic API credential — the agent hook calls the model directly, no separate `claude` CLI subprocess.

## Configuration

No configuration. Install the plugin and the hook fires automatically on every `git commit` invoked through the `Bash` tool. The agent runs Sonnet 4.6 with a 120s timeout.
