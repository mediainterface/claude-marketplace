# Azure DevOps via the Azure CLI — shared reference

Shared setup and reference for the skills of the `ado-toolkit` plugin (`ado-pr`,
`ado-workitem`, `ado-pipeline`). They talk to Azure DevOps through the Azure CLI (`az`) with
the `azure-devops` extension instead of REST/MCP, and target the **newest** Azure DevOps
**Server** version. They replace the MCP-based `azure-devops` plugin, which is obsolete and
will be removed.

**A git checkout is always the starting point.** The skills run inside a repository whose
`origin` lives on Azure DevOps: that remote decides which server, collection and project they
talk to, and the checkout is the material many actions work from — a PR from the current
branch, a work item written from a change in the code. Outside such a checkout they stop
(Step 0, step 3).

**Run Step 0 once, before the first `az` command.** The **Setup Check** runs only when an `az`
command fails. The Discovery cache, Command Map, Repository Mismatch Check, Quirks,
Written-as-the-user, and Error-handling rules here apply to all three skills.

> **Names depend on the server and the project.** Work item types, states, fields and relation
> types carry the server's language and the project's process: a German server says `Aufgabe`,
> not `Task`, and `Übergeordnetes Element`, not `parent`; another team's server or a new
> project may name them differently again. Never assume them — take them from the **Discovery
> cache** below. German text keeps its real umlauts/ß — see **German text**. The skills assume
> you are **already signed in**; they never authenticate for you (see **Setup Check**).

## Step 0: Detect ADO Connection

1. Run `git remote get-url origin` via Bash.
2. Parse the remote URL into `organization` (a full URL), `project`, and `repository`.
   Recognise these forms:
   - **HTTPS:** `https://{host}[:port]/{collection}/{project}/_git/{repo}`
     → `organization = https://{host}[:port]/{collection}`
   - **SSH:** `ssh://{host}[:port]/{collection}/{project}/_git/{repo}` or
     `{user}@{host}:{collection}/{project}/_git/{repo}` → take `{collection}`, `{project}`,
     and `{repo}` from the path and build `organization = https://{host}/{collection}`
     (confirm the HTTPS base with the user if the host/port is ambiguous).
3. If there is no git repository, no `origin`, or the URL matches no Azure DevOps form,
   tell the user these skills only work inside a checkout of an Azure DevOps repository and
   stop.
4. Set CLI defaults so later commands are terse:
   ```bash
   az devops configure --defaults organization={organization} project={project}
   ```
   Still pass `--org {organization}` (plus `--project {project} --detect false` where
   the command accepts them) explicitly on the commands below — defaults are a
   convenience, explicit args are the contract. Note: `az repos pr show` and
   `az repos pr update` take only `--id` and `--org` (a PR ID is org-unique), so they
   do not get `--project`.
5. Store `organization`, `project`, `repository`. Use them for ALL subsequent `az` calls.

## Setup Check — when an `az` command fails

There is no check up front: the first real command shows whether the toolchain works, and a
working setup costs no extra call. When an `az` command fails, match its error against the
cases below **before anything else**; on a match, give the fix and **stop**.

1. **Azure CLI missing** — `az: command not found` (Windows: `'az' is not recognized`):
   > **Azure CLI is not installed.** Install it, then re-run.
   > - macOS: `brew install azure-cli`
   > - Windows: `winget install -e --id Microsoft.AzureCLI`
   > - Linux / other: https://learn.microsoft.com/cli/azure/install-azure-cli

2. **azure-devops extension missing** — `az` does not know the command group (e.g.
   `'repos' is misspelled or not recognized`; `az extension show --name azure-devops` confirms):
   ```bash
   az extension add --name azure-devops
   ```

3. **Not signed in** — HTTP 401/403, `TF400813`, or a message that the user is not authorized
   or not logged in. Do **not** authenticate on their behalf — never run `az devops login`,
   set auth environment variables, or read a PAT from the environment yourself. Show the
   **authentication instructions** below and wait until the user confirms they have signed in.

### Authentication instructions (show these to the user; do not act on them yourself)

> **You are not signed in to Azure DevOps in the Azure CLI.** Please sign in yourself, then
> tell me to continue.
>
> **1. Create a Personal Access Token (PAT):**
> 1. Open your Azure DevOps Server in the browser.
> 2. Profile picture (top right) → **Security** → **Personal access tokens**.
> 3. Click **+ New Token**, give it a descriptive name (e.g. `claude-code`), set an expiration.
> 4. Select the scopes the skills' workflows need:
>    - **Code** — Read & write (PR review/create/update, repository and changelog access)
>    - **Build** — Read (pipeline analysis)
>    - **Work Items** — Read & write (work item create/show/query/update)
> 5. Click **Create** and copy the token.
>
> **2. Sign in with the PAT:**
> ```bash
> az devops login --org {organization}
> ```
> Paste the PAT when prompted.
>
> (A PAT you already use for the obsolete MCP-based `azure-devops` plugin works as well.)

After giving any Setup Check instruction (cases 1–3), **stop** — run no further `az`
commands and do no work until it is resolved; for sign-in, until the user confirms.

## Discovery cache

Names on the server — work item types, their states and fields, relation types — are looked up
once and kept in a cache file per collection, so later commands and sessions skip the lookup.
They rarely change, and when they do, the next command that needs them notices.

**File:** `${CLAUDE_PLUGIN_DATA}/discovery/{host}-{collection}.json` — `{host}` without port,
every character other than a letter, digit, `.`, `_` or `-` replaced by `-`. Read and write it
with the Read and Write tools (the directory may not exist yet; Write creates it). Shape:

```json
{
  "relationTypes": {
    "System.LinkTypes.Hierarchy-Reverse": "Übergeordnetes Element",
    "System.LinkTypes.Hierarchy-Forward": "Untergeordnet"
  },
  "projects": {
    "{project}": {
      "types": { "Microsoft.VSTS.WorkItemTypes.Bug": "Fehler", "Microsoft.VSTS.WorkItemTypes.Task": "Aufgabe" },
      "states": { "Fehler": ["Neu", "Aktiv", "Geschlossen"] },
      "fields": { "Fehler": ["System.Description", "Microsoft.VSTS.TCM.ReproSteps"] }
    }
  }
}
```

**Rules:**
- **Read the file first.** Use what it has. Fetch only what is missing — the type list once per
  project, states and fields per type when that type is first needed, relation types once per
  collection — then write the file back with the new entry added and every other entry kept.
- **Refresh on rejection.** When the server rejects a cached name (unknown type, state, field
  or relation type), fetch that one part again, update the file, and retry the command once.
- **Reload on request.** When the user asks to reload, delete the project's entry (or the file)
  and fetch anew.
- **No expiry.** Something added on the server shows up as a missing entry the first time it is
  needed; something renamed or removed shows up as a rejection.
- **Only names go in** — no teams, area or iteration paths, people, work item content, or
  credentials.

**Lookups** — each returns just the names, keeping the output small:
```bash
# types of a project
az devops invoke --area wit --resource workItemTypes --route-parameters project={project} \
  --org {org} --api-version 7.1 --query "value[].{name:name, referenceName:referenceName}" -o json
# fields of one type
az devops invoke --area wit --resource workItemTypes --route-parameters project={project} "type={typeName}" \
  --org {org} --api-version 7.1 --query "fields[].referenceName" -o json
# states of one type
az devops invoke --area wit --resource workItemTypeStates --route-parameters project={project} "type={typeName}" \
  --org {org} --api-version 7.1 --query "value[].name" -o json
# parent/child relation types of the collection
az boards work-item relation list-type --org {org} \
  --query "[?starts_with(referenceName, 'System.LinkTypes.Hierarchy')].{referenceName:referenceName, name:name}" -o json
```

## Quirks — expected false signals (do NOT treat as errors)

The Azure CLI produces two misleading outputs that are safe to ignore. In both cases,
**proceed as if the operation succeeded**; the user will call it out if something
genuinely failed.

1. **Emoji stripped from the return value.** When a PR or work item title/description
   contains an emoji, the CLI may print JSON with the emoji missing even though the resource
   actually has it — **verified present in the web UI**. This has been observed as a
   **Windows console-encoding (cp1252) artifact**; the echo/input behaviour may differ on
   macOS/Linux, so **verify once per platform** rather than treating it as a universal
   guarantee. Once confirmed for your platform, do **not** retry, "fix", or warn about a
   missing emoji in the returned JSON — check the web UI if unsure. The same echo artifact
   can hit umlauts/ß (`Prüfung` shown as `Pr?fung` or `PrÃ¼fung`) — equally cosmetic; never
   change the *input* text in response (see **German text** below).

2. **False compatibility warning.** The CLI may print a warning that it is not
   compatible with this Azure DevOps Server version. This is a **false positive** — the
   CLI has been fully tested against our server and every workflow works.
   Ignore the warning and continue.

## German text — real characters, never transliterated

All German text sent **to** ADO — titles, descriptions, comment bodies, WIQL values — is
written with its real characters: **ä ö ü Ä Ö Ü ß** (and the title-schema emoji). It reads
`Prüfung überarbeiten` — never `Pruefung ueberarbeiten`, `&uuml;`, or a `\u00fc` escape. This holds
for CLI arguments (`--title`, `--description`, `--state`, …) and for JSON bodies passed via
`--in-file`: write those temp files as plain UTF-8 and JSON-escape only what JSON requires
(quotes, backslashes, newlines) — umlauts stay literal.

- **A mangled echo is Quirk 1, not bad input.** `Pr?fung` or `PrÃ¼fung` in the CLI's
  returned JSON means the *console* mis-rendered the value; the stored resource is correct
  (check the web UI if unsure). Do not "protect" the next call by ASCII-fying its text.
- **On a real encoding error** (e.g. `UnicodeEncodeError: 'charmap' codec can't encode …`),
  fix the environment and retry the **identical** text — e.g. `PYTHONIOENCODING=utf-8`
  (on Windows additionally `chcp 65001`), or move the text into an `--in-file` body.
  Resending the text without umlauts is not a fix — it silently corrupts the resource.

## Line breaks — never hard-wrap ADO text

Titles, descriptions, and comment bodies sent **to** ADO are not wrapped at a fixed column.
The two kinds of text render differently:

- **Pull requests** (description, comment threads) are **Markdown**, which commonly renders a
  single newline as a line break — a hard-wrapped paragraph arrives as a column of ragged
  short lines. Keep each paragraph on one line and separate paragraphs with a blank line;
  lists, tables, and code fences work as usual.
- **Work items** (description, acceptance criteria, repro steps, resolution, comments) are
  **HTML**: a newline is just a space, so structure comes from `<p>`, `<ul><li>` and the like
  (see the `ado-workitem` skill).

A wrap rule a repository sets for its Markdown **files** applies to those files, never to
text typed into an ADO field.

## Written as the user

Everything sent through `az` — PR descriptions, PR and work item comments, work item fields —
appears in ADO under the **user's** name. Write it as they would: never name the user, never
refer to them in the third person ("the objection above holds", not "<name> is right"), and
keep explanations meant only for the user in the chat. Show the text before posting it.

## Title schema (PRs & work items)

**PR titles** (`ado-pr`) — `<Marker> #<WorkItemId> <Component/Application> - <Beschreibung>`:

- **`<Marker>`** — a change-category **emoji**: 🐞 bug, 🏗️ refactor, 📖 docs,
  🏆 feature/default (the PR-creation workflow defines how it is chosen). A skill that runs
  that workflow for its own kind of PR may prescribe a marker of its own instead.
- **`#<WorkItemId>`** — a `#1234` reference to the delivered work item, which ADO renders as
  an auto-link. It is only the *readable* reference; the actual PR↔work-item link is **always**
  set separately (`az repos pr work-item add`) and is never replaced by the mention.
- **`<Component/Application>`** — the specific affected app/component, e.g. `mira-desktop`,
  `controller-app`. Derive it from context (commit scopes, file paths, the PR's subject);
  **if it cannot be determined confidently, ask the user** — do not guess.
- **`<Beschreibung>`** — a concise German summary (real umlauts/ß — see **German text** above).

**Work item titles** (`ado-workitem`) — just the concise German description, `<Beschreibung>`.
**No marker, no `#<ID>`, no component prefix** — those made titles long and hard to read. The
parent relationship is still set separately (the parent relation), it is just not shown in the
title.

> Example: `Commit, Docs-PR erstellen, Nach-Merge-Pipelinelauf prüfen` — **not**
> `User Story #250 docs - Commit, Docs-PR erstellen, Nach-Merge-Pipelinelauf prüfen`.

(Per Quirks, an emoji in a returned PR title may be missing from the CLI's JSON — expected;
the resource has it.)

## Command Map (REST endpoint → az command)

`{org}` = `organization`, `{project}`, `{repo}` = `repository` from Step 0. Request JSON
with `-o json`. For endpoints without a first-class command, use `az devops invoke`
(it authenticates the same way). If an `invoke` `--resource` name is ever rejected,
discover the correct one with `az devops invoke --query "[?area=='build']"` (or
`'git'` / `'wit'`) and match the `routeTemplate`.

| Purpose | Command |
|---|---|
| Build metadata | `az pipelines build show --id {buildId} --org {org} --project {project} --detect false -o json` |
| Build timeline | `az devops invoke --area build --resource Timeline --route-parameters project={project} buildId={buildId} --org {org} --api-version 7.1 -o json` |
| Task log | `az devops invoke --area build --resource logs --route-parameters project={project} buildId={buildId} logId={logId} --org {org} --api-version 7.1 -o json` |
| Build changes (commits) | `az devops invoke --area build --resource Changes --route-parameters project={project} buildId={buildId} --org {org} --api-version 7.1 -o json` |
| Pipeline definition | `az pipelines build definition show --id {definitionId} --org {org} --project {project} --detect false -o json` |
| Repository metadata | `az repos show --repository {repo} --org {org} --project {project} --detect false -o json` |
| PR metadata | `az repos pr show --id {prId} --org {org} -o json` |
| Create PR | `az repos pr create --repository {repo} --source-branch {source} --target-branch {target} --title "{title}" --description "{description}" --org {org} --project {project} --detect false -o json` |
| Update PR | `az repos pr update --id {prId} [--title "{title}"] [--description "{description}"] [--status active\|abandoned\|completed] --org {org} -o json` |
| List active PRs by source branch | `az repos pr list --repository {repo} --source-branch {branch} --status active --org {org} --project {project} --detect false -o json` |
| PR comment threads (list) | `az devops invoke --area git --resource pullRequestThreads --route-parameters project={project} repositoryId={repo} pullRequestId={prId} --org {org} --api-version 7.1 -o json` |
| Add PR comment thread | `az devops invoke --area git --resource pullRequestThreads --route-parameters project={project} repositoryId={repo} pullRequestId={prId} --http-method POST --in-file {body.json} --media-type application/json --org {org} --api-version 7.1 -o json` |
| Reply to a PR thread | `az devops invoke --area git --resource pullRequestThreadComments --route-parameters project={project} repositoryId={repo} pullRequestId={prId} threadId={threadId} --http-method POST --in-file {body.json} --media-type application/json --org {org} --api-version 7.1 -o json` |
| Resolve/reopen a PR thread | `az devops invoke --area git --resource pullRequestThreads --route-parameters project={project} repositoryId={repo} pullRequestId={prId} threadId={threadId} --http-method PATCH --in-file {body.json} --media-type application/json --org {org} --api-version 7.1 -o json` |
| Link / list / unlink PR work items | `az repos pr work-item add\|list\|remove --id {prId} [--work-items {id}] --org {org} -o json` |
| Work item types, fields, states, relation types | Read the **Discovery cache** first; its lookups fetch only what is missing |
| Show work item | `az boards work-item show --id {id} --org {org} -o json` |
| Create work item | `az boards work-item create --title "{title}" --type "{typeName}" [--description "{descriptionHtml}"] [--fields "{referenceName}={html}" …] [--assigned-to "{displayName}"] --area "{project}\{team}" --iteration "{project}\{team}" --org {org} --project {project} -o json` |
| Update work item | `az boards work-item update --id {id} [--title "{title}"] [--state "{stateName}"] [--assigned-to "{displayName}"] [--description "{descriptionHtml}"] [--fields "{referenceName}={html}" …] --org {org} -o json` |
| Link work item to parent | `az boards work-item relation add --id {childId} --relation-type "{parentRelationName}" --target-id {parentId} --org {org} -o json` (name from the Discovery cache, e.g. `"Übergeordnetes Element"`) |
| Work item comments (list) | `az devops invoke --area wit --resource comments --route-parameters project={project} workItemId={id} --org {org} --api-version 7.1-preview -o json` |
| Add work item comment | `az boards work-item update --id {id} --discussion "{commentHtml}" --org {org} -o json` |
| Query work items (WIQL) | `az boards query --wiql "{wiql}" --org {org} --project {project} -o json` |

**CLI-vs-REST differences to remember:**
- `--source-branch` / `--target-branch` take the **bare** branch name (`feature/x`), NOT
  `refs/heads/feature/x`. Always strip the `refs/heads/` prefix before passing.
- `az repos show` returns `defaultBranch` as `refs/heads/{name}` — strip the prefix for
  local git operations, same as the REST skill.
- The task-log `invoke` returns a JSON object with a `value` array of log lines; join
  that array to reconstruct the plain-text log.
- **Localized names:** `--type` / `--state` / `--relation-type` and WIQL *values* take the
  server's display names (on a German server `Aufgabe`, `Aktiv`, `Übergeordnetes Element`) —
  take them from the **Discovery cache**. WIQL *field reference names* (`System.WorkItemType`,
  `System.State`) stay invariant English.
- `--assigned-to` takes the user's **display name** (`"Erika Mustermann"`); an e-mail address
  or `DOMAIN\account` is rejected as an unknown identity.
- `az` reads stdin. Inside a `while read` loop it swallows the loop's input and hangs — call it
  with `</dev/null` there.
- A **preview** API version is written `7.1-preview`, without the `.N` suffix: the CLI fails to
  parse `7.1-preview.4` ("could not convert string to float").

## Repository Mismatch Check

When the user provides a URL or build ID, the referenced resource may belong to a
different repository than the one you are in. After fetching metadata, compare the
repository name in the response against the local `repository` from Step 0. If they
differ, warn before proceeding:
> "The build/PR belongs to repository **{remote repo}**, but you are currently in
> **{local repo}**. Local git operations (reading pipeline YAML, checking out branches,
> generating diffs) will use the wrong codebase. Do you want to continue anyway?"

Only proceed if the user explicitly confirms.

## Error handling & local-state safety

Some workflows check out a branch/commit and stash the user's uncommitted work. Treat the
**checkout and its restore as a try/finally**: before checking out, record the current
branch (or commit, if detached) as `originalRef` and whether you stashed; then guarantee the
restore runs **whether the workflow succeeds, errors, or is interrupted** — never leave the
user in a detached HEAD with their changes still stashed.

On any `az`/`git` failure or interruption:
1. **Restore local git state first** — `git checkout {originalRef}`, then `git stash pop` if
   you stashed — before doing anything else.
2. **Report, don't paper over** — show the exact command that failed and its error output,
   then **stop**. Do not silently retry, guess, or fall back to another transport (e.g.
   API-based changes).
3. **Auth errors (HTTP 401/403):** stop and follow the Setup Check sign-in instructions.
