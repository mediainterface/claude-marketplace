#!/usr/bin/env bash
# Auto-update CLAUDE.md files when staged changes affect documented architecture.
# Used as a PreToolUse hook on Bash, filtered by "if": "Bash(git commit:*)".
# Replaces the agent hook to work around: https://github.com/anthropics/claude-code/issues/22637

cat > /dev/null  # consume stdin

# Skip if no staged changes
if ! git diff --cached --quiet 2>/dev/null; then
  : # there are staged changes, continue
else
  exit 0
fi

# Find CLAUDE.md files in the repo (not in ~/.claude/)
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$REPO_ROOT" ]; then
  exit 0
fi

CLAUDE_MDS=$(find "$REPO_ROOT" -name "CLAUDE.md" -not -path "*/.claude/*" -not -path "*/node_modules/*" -not -path "$REPO_ROOT/.worktrees/*" 2>/dev/null)
if [ -z "$CLAUDE_MDS" ]; then
  exit 0
fi

# Use claude CLI in print mode to analyze and update CLAUDE.md files
claude -p \
  --model claude-sonnet-4-6 \
  --max-turns 3 \
  --allowedTools "Read,Edit,Bash(git add:*),Bash(git diff:*)" \
  "A git commit is about to be made in ${REPO_ROOT}. Check if any CLAUDE.md files need updating to reflect the staged changes.

1. Run: git diff --cached
2. Read each CLAUDE.md file listed below and compare against the staged diff
3. ONLY update if changes affect: documented architecture, conventions, commands, prerequisites, project structure, or skill descriptions
4. Do NOT update for: bug fixes, minor code changes, test updates, formatting, or things already reflected in CLAUDE.md
5. If you edit a CLAUDE.md, run: git add <path-to-CLAUDE.md>

CLAUDE.md files to check:
${CLAUDE_MDS}

Be minimal — only add or modify lines that are directly affected. If nothing needs updating, do nothing." \
  > /dev/null 2>&1

exit 0
