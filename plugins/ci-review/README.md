# ci-review

Unattended pull request reviews for the CI pipeline. A review skill reviews the checked-out PR
in one pass and writes `findings.json`; the pipeline posts it with `ado-toolkit` (`/ado-pr`,
*Post a findings file*). The skills never talk to Azure DevOps themselves, and they never start
on their own in an interactive session (`disable-model-invocation`) — for an interactive review
use `sdd-kit:pr-review`.

| Skill | What it reviews |
|---|---|
| `/ci-pr-review` | A code PR as a whole: against what it is meant to do (title, description, work items), the repository's `CLAUDE.md` files, `.claude/rules/`, active decision records and test process. Only blockers and shoulds, each verified against the code, as post-ready German comments. Documentation-only PRs are skipped. |

All review skills write the same format, so one posting step serves them all. What they share
lives in `skills/review-shared/`:

| File | Purpose |
|---|---|
| `findings.schema.json` | JSON Schema (draft-07) of `findings.json`, the whole contract. The `ado-toolkit` poster reads and checks the part it posts |
| `validate_findings.py` | What a skill runs in its own loop until it passes: the schema plus what a schema cannot check — anchors on existing lines of changed files, a review log that covers the skill's checks (its `review.json`), PR and head from `pr.json` |

## Install

```
claude plugin install ci-review@mediainterface
```

## Prerequisites

- **A checkout of the PR's repository** at the PR head, with the target commit fetched so the
  merge base can be computed. `/ci-pr-review` measures the change against the conventions it
  finds there (`CLAUDE.md` files, `.claude/rules/`, `docs/decisions/`, `docs/processes/testing/`)
  and applies only those that exist.
- **Git and Python 3** (standard library only) on the build agent.
- **The Claude Agent SDK** (or the Claude Code CLI) with credentials for the model.
- **For posting:** the `ado-toolkit` plugin and the Azure CLI with its `azure-devops` extension.
  The review itself does not need them, so `ci-review` does not depend on `ado-toolkit`: a
  declared dependency would keep the SDK from loading the plugin on its own.

## Running a review in the pipeline

1. **Check out the PR**, detached at its source commit, and fetch the target commit.
2. **Take the plugins from this marketplace**, at a pinned commit or as installed plugins —
   never from the PR checkout, so a PR cannot rewrite its own reviewer.
3. **Write the context directory** (below) outside the checkout.
4. **Run the skill** with the Agent SDK:

   ```ts
   query({
     prompt: `/ci-review:ci-pr-review ${contextDir}`, // absolute path
     options: {
       cwd: checkoutDir,
       model: 'claude-opus-5-5',
       systemPrompt: { type: 'preset', preset: 'claude_code' },
       settingSources: [], // no CLAUDE.md, settings, hooks or MCP servers from the PR
       plugins: [{ type: 'local', path: `${marketplaceDir}/plugins/ci-review` }],
       tools: ['Read', 'Grep', 'Glob', 'Write', 'Bash'],
       // reads inside cwd and additionalDirectories need no rule; writes only to contextDir
       allowedTools: ['Bash(git *)', 'Bash(python3 *)', `Edit(/${contextDir}/**)`],
       permissionMode: 'dontAsk', // anything not allowed is denied
       additionalDirectories: [contextDir],
       maxTurns: 100,
       maxBudgetUsd: 5,
     },
   })
   ```

   `settingSources: []` matters: the PR checkout's `.claude/settings.json` may bring hooks and a
   developer allow list (`curl`, `WebFetch`, …) into the run. The skill reads the repository's
   conventions itself, as data. With these options the review reads only the checkout and the
   context directory and writes only to the context directory. Bash rules match by prefix, and
   a compound command must match for every part, so the skills run each `git` and `python3`
   command on its own. `git` and `python3` can still run arbitrary code, though: run the review
   step without the Azure DevOps token — only the posting step gets it — on an agent that
   holds no other secrets. A code PR costs about 1–2 USD and 2–3 minutes with Opus, a skipped
   PR well under 0.50 USD.
5. **Post the result** when the run ended with the result subtype `success` and
   `findings.json` exists, from inside the checkout:

   ```bash
   python3 "$MARKETPLACE_DIR/plugins/ado-toolkit/skills/ado-pr/scripts/post_findings.py" \
     "$CONTEXT_DIR/findings.json"
   ```

   It posts without a model in between, only a `reviewed` result whose `reviewedCommit` is
   still the PR head, and nothing that is already on the PR. Write `reason` and `reviewLog` to
   the build log; a failed run or a missing file is a warning there, never a comment.

## Context directory (input)

| File | Content |
|---|---|
| `pr.json` (required) | `pullRequestId`, `title`, `description`, `author`, `sourceBranch` and `targetBranch` (without `refs/heads/`), `sourceCommit` (the PR head), `targetCommit`, and `workItems` — each with `id`, `type`, `state`, `title`, `description`, `acceptanceCriteria` as plain text, HTML removed |
| `threads.json` (optional) | The PR's existing threads, deleted ones and system comments left out — each with `id`, `status`, `filePath` (repo-relative, `null` for a PR-level thread), `line`, and `comments` (`author`, `content`). Include the threads earlier runs posted: the skills drop every point that is already raised |

## `findings.json` (output)

The schema carries the field descriptions. In short:

- `status` — only `reviewed` is posted; `skipped` (PR outside the skill's scope) and `error`
  (the review could not run) only explain themselves in `reason`.
- `findings` — one new active thread per entry, in order. `comment` is post-ready German
  Markdown; the poster puts a header above it that marks the comment as automated and names
  `skill` and the severity (`blocker` or `should`).
- Anchor — `file` + `startLine` + `endLine` is a range on the right side (the file at
  `reviewedCommit`); `file` alone is a comment on the whole file; no `file` is a comment on the
  whole PR.
- `category`, `baseCommit` and `reviewLog` are for the build log and statistics; the poster
  ignores them.

## Adding a review skill

- `skills/<name>/SKILL.md` with `disable-model-invocation: true` (only the pipeline runs it)
  and `allowed-tools` limited to what the review needs — no `az`, posting is `ado-toolkit`'s
  job.
- `skills/<name>/review.json` — `{ "checks": [...] }`, the checks its review log must cover,
  each exactly once.
- The skill reads the context directory above, writes `<contextDir>/findings.json` with
  `"skill": "<name>"`, and runs
  `python3 ${CLAUDE_SKILL_DIR}/../review-shared/validate_findings.py <contextDir>/findings.json`
  until it passes.
- Add it to the skill table above.
