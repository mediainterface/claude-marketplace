---
name: ado-workitem
description: >-
  Azure DevOps work items (tickets) via the Azure CLI (az + azure-devops extension) — create,
  show, query (WIQL), update, and comment on work items, with each type's content in its own
  field (acceptance criteria, repro steps, resolution) and the team's Area/Iteration. Type,
  state, field and relation names depend on the server and project (a German server says
  Aufgabe, not Task, and "Übergeordnetes Element", not parent); they come from a discovery cache
  and are fetched only when missing or rejected. Use when the user mentions an ADO work item /
  ticket / Arbeitselement / Aufgabe / Fehler / User Story, or asks to create, find, update, or
  comment on one. Newest Azure DevOps Server; assumes you are already signed in (PAT).
argument-hint: <workitem [create|show|query|update|comment] | WORKITEM_ID>
allowed-tools: Bash, Read, Write, Glob, Grep
---

# Azure DevOps — Work Items (CLI)

Work-item workflows for Azure DevOps via the Azure CLI (`az` + `azure-devops` extension):
**create**, **show**, **query**, **update**, and **comment** on work items. Use this skill when
the user asks to create, find, update, or comment on an Azure DevOps work item or ticket
(*Arbeitselement* — e.g. *Aufgabe*, *Fehler*, *User Story*).

> **Shared setup first.** Before the first `az` command, run **Step 0 (connection detection)**
> in [../ado-shared/REFERENCE.md](../ado-shared/REFERENCE.md); when an `az` command fails, its
> **Setup Check** diagnoses the error first. That file also holds the
> **Command Map**, **Title schema**, **German text** (umlauts verbatim), **Written as the
> user**, **Quirks**, and **Error handling** rules. `{org}` = `organization`, `{project}` come
> from Step 0.

> **Never assume a name.** Types, states, fields and relation types depend on the server's
> language and the project's process — on a German server `Task` is **Aufgabe**, `Active` is
> **Aktiv**, the parent relation is **"Übergeordnetes Element"**; another server or a new
> project may differ again. Take them from the **Discovery cache** (Step 1). The examples in
> this skill come from one German server; treat them as examples. All German text you send
> keeps its real characters — `Prüfung`, never `Pruefung` (see **German text** in the shared
> reference).

---

## Workflow: Work Item Management

**Trigger:** User asks to create, show, query, update, or comment on an Azure DevOps **work
item** or ticket (German: *Arbeitselement*), or `$ARGUMENTS` starts with `workitem` (e.g.
`workitem create`, `workitem show 1234`, `workitem update 1234`, `workitem comment 1234`).

### Step 1 — Names from the discovery cache (before create/query/update)
Read the **Discovery cache** file for this collection (shared reference) and take from it what
the task needs; fetch with its lookups only what is missing, then write the file back:

- **Type names** — the display `name` is what `--type` and WIQL `[System.WorkItemType]` values
  expect. Map a type the user names in another language by its `referenceName` (`Task` →
  `Microsoft.VSTS.WorkItemTypes.Task` → e.g. `Aufgabe`); if nothing matches, show the types and
  ask — do not invent one.
- **Fields of the type** — check there that a field exists before you set it (see **Fields by
  type** below).
- **States of the type** — before a state change or a WIQL filter on `[System.State]`.
- **Relation types** — before linking: the parent relation is the one with `referenceName`
  `System.LinkTypes.Hierarchy-Reverse`, the child relation `…Hierarchy-Forward`; pass their
  display `name` to `--relation-type`. The English `parent` / `child` only work on an English
  server.

When the server rejects a cached name, refresh that entry and retry once (shared reference).

### Fields by type

Every multi-line field — description, acceptance criteria, repro steps, resolution — and every
comment is **HTML**, not Markdown: `<p>` for paragraphs, `<ul><li>` for lists, `<h3>` for an
occasional heading, umlauts literal, no hard line breaks (a newline in HTML is just a space).
Escape a literal `<` or `&` in the text as `&lt;` / `&amp;`.

Each kind of content has its own field when the type has one. Putting everything into the
description hides it from the field the team reads it in. Look the fields up in the type's
field list from step 1; the reference names below are those of the standard processes:

| Content | Field, if the type has it |
|---|---|
| Story sentence, problem, context, task description | `System.Description` (`--description`) |
| Acceptance criteria, as a list | `Microsoft.VSTS.Common.AcceptanceCriteria` |
| Bug: what happens, steps to reproduce, expected vs. actual | `Microsoft.VSTS.TCM.ReproSteps` — a bug type that has it shows this field on its form, not the description |
| Bug: the solution after the fix — cause, change, measured values where they matter, why the existing tests did not catch it | `Microsoft.VSTS.Common.Resolution` |

Set fields other than title, description, state, assignee, area and iteration with `--fields`,
one quoted `referenceName=value` pair each. Build longer HTML in a variable so the shell
quoting stays simple:
```bash
ac=$(cat <<'HTML'
<ul><li>Der Dialog zeigt …</li><li>Nach dem Speichern …</li></ul>
HTML
)
az boards work-item update --id {id} --fields "Microsoft.VSTS.Common.AcceptanceCriteria=$ac" --org {org} -o json
```
If the type lacks the field the table names, show the user the type's fields from step 1 and
ask where the content goes.

Writing the **Resolution** of a bug does not change its state: tell the user the state can
move on, and leave the change to them unless they ask for it.

### Writing tickets

A ticket is read by people who did not see the conversation — the PO, another team, IT. Before
showing a draft, ask of each paragraph whether the reader needs it to act or decide, and cut
the rest:

- No step-by-step instructions for the reader's own field, no "please don't" lists, no
  rationale the reader does not need, no background that only holds under an assumption, and
  nothing the user cannot deliver or decide.
- Plain language: what changes for whom, with a small example. Identifiers only where the
  reader finds them in the UI or the code they work in.
- Bullets rather than prose; short is better than complete.
- Everything is posted under the user's name — see **Written as the user** in the shared
  reference.

**Show the draft** — title, fields, Area/Iteration, parent — and create or change the work item
only after the user approved it.

### Team: Area and Iteration

A team's work items have **both** Area and Iteration on the team's node, `{project}\{team}`
(project-relative, backslash-separated). If the team plans in sprints and a sprint is named,
the iteration may be that sprint below the team node.

**The team is asked, or known from the context** — the user named it in this conversation, or
the repository's `CLAUDE.md` / `.claude/rules/` name it. Never infer it from the parent, the
siblings, or other tickets: those sometimes sit on the project root or on another team, and the
wrong team then never sees the ticket.

The project root is just `{project}` (no team). When showing a work item, a ticket that sits on
the root is not a defect to report — some are put there on purpose.
```bash
# put a work item on a team
az boards work-item update --id {id} --area "{project}\{team}" --iteration "{project}\{team}" --org {org} -o json
# clear the team (back to the project root)
az boards work-item update --id {id} --area "{project}" --iteration "{project}" --org {org} -o json
```

### Create
1. Run **step 1** for the type (its name, fields and, for the parent link, the relation
   types).
2. Gather: the **type**; the **content**, split into the fields of its type (see **Fields by
   type**); the **parent work item** (its ID — the default; almost every item sits under one);
   the **team** (see **Team: Area and Iteration** — ask if the context does not name it); and
   optionally the assignee. `--assigned-to` takes the **display name** (`"Erika Mustermann"`),
   not the e-mail or the `DOMAIN\account` — look an unknown one up in
   `System.AssignedTo.displayName` of an existing work item.
3. **Build the title:** just the concise German description (`<Beschreibung>`) — see the
   shared **Title schema**. Do **not** prefix the parent type, a `#<ID>`, or the component;
   work item titles are the description alone (that prefix made them long and unreadable).
   The parent is still linked in step 6 — it is just not shown in the title. Example:
   `Wartungsdialog überarbeiten` — with the real `ü`, never `ueberarbeiten` (shared
   **German text** rule; the same goes for every field).
4. **Show the draft** and wait for the user's approval (see **Writing tickets**).
5. Create the work item:
   ```bash
   az boards work-item create --title "{title}" --type "{typeName}" \
     [--description "{descriptionHtml}"] [--fields "{referenceName}={html}" …] \
     [--assigned-to "{displayName}"] --area "{project}\{team}" --iteration "{project}\{team}" \
     --org {org} --project {project} -o json
   ```
6. **Link to the parent** (if any — the default; this parent relation is the real link, and
   the only place the parent is recorded now that the title no longer carries a
   `#<ParentID>` reference), with the parent relation's name from step 1:
   ```bash
   az boards work-item relation add --id {newId} --relation-type "{parentRelationName}" \
     --target-id {parentId} --org {org} -o json
   ```
7. Report the new work item ID and URL.

### Show / Query
- **Show one:** `az boards work-item show --id {id} --org {org} -o json`. Read the content from
  the fields of its type (a bug's description is often empty — its content is in
  `Microsoft.VSTS.TCM.ReproSteps`); add its comments when they matter (see **Comment**).
- **Query many (WIQL):** build the query with the names from step 1 (example values from a
  German server):
  ```bash
  az boards query --org {org} --project {project} -o json \
    --wiql "SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.WorkItemType] = 'Aufgabe' AND [System.State] <> 'Geschlossen' ORDER BY [System.ChangedDate] DESC"
  ```
  Field reference names (`[System.WorkItemType]`, `[System.State]`) are invariant English;
  the **values** (`'Aufgabe'`, `'Geschlossen'`) are the display names from step 1.

### Update
1. Identify the work item (ID from the user, or via Show/Query above).
2. For a **state** change, take the valid states of its type from step 1 first.
3. Update only the fields being changed, each in the field of its type (see **Fields by
   type**). **When changing the title**, set it to the concise German description
   (`<Beschreibung>`) per the shared **Title schema** — no parent type, `#<ID>`, or component
   prefix. Show the change (old vs. new) and wait for approval before sending it.
   ```bash
   az boards work-item update --id {id} [--title "{title}"] [--state "{stateName}"] \
     [--area "{areaPath}"] [--iteration "{iterationPath}"] [--assigned-to "{displayName}"] \
     [--description "{descriptionHtml}"] [--fields "{referenceName}={html}" …] --org {org} -o json
   ```
4. Confirm the change and report the work item URL.

### Comment
Work item comments form one flat discussion — no threads, no replies, nothing to resolve
(unlike PR comments). To answer someone, write a new comment that says what it answers.

- **Read** the discussion (HTML, newest first):
  ```bash
  az devops invoke --area wit --resource comments \
    --route-parameters project={project} workItemId={id} \
    --org {org} --api-version 7.1-preview -o json
  ```
  The API version is exactly `7.1-preview`: the CLI fails to parse `7.1-preview.4` ("could not
  convert string to float"), and the server rejects a plain `7.1` for this preview resource.
- **Add** a comment:
  ```bash
  az boards work-item update --id {id} --discussion "{commentHtml}" --org {org} -o json
  ```
  HTML like every other field (`<p>`, `<ul>`), at most three sentences or a few bullets,
  ending in a concrete proposal or a real question when one is due. Show it to the user before
  posting — it appears under their name (**Written as the user**).

Editing or deleting an existing comment is not covered here; point the user to the web UI.
