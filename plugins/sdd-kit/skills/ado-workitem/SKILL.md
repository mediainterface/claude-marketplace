---
name: ado-workitem
description: >-
  Azure DevOps work items via the Azure CLI (az + azure-devops extension) — create, show,
  query (WIQL), and update work items. The Server is German-localized, so types and states
  are German (Aufgabe not Task, Aktiv not Active) and are fetched from the server before
  assuming. Use when the user mentions an ADO work item / Arbeitselement / Aufgabe / Fehler,
  or asks to create, find, or update a work item. Newest Azure DevOps Server; assumes you are
  already signed in (PAT).
argument-hint: <workitem [create|show|query|update] | WORKITEM_ID>
allowed-tools: Bash, Read, Glob, Grep
---

# Azure DevOps — Work Items (CLI)

Work-item workflows for Azure DevOps via the Azure CLI (`az` + `azure-devops` extension):
**create**, **show**, **query**, and **update** work items. Use this skill when the user
asks to create, find, or update an Azure DevOps work item (*Arbeitselement* — e.g.
*Aufgabe*, *Fehler*, *Benutzergeschichte*).

> **Shared setup first.** Before any `az` command, complete **Step 0 (connection detection)**
> and the **Setup Check (sign-in confirmation)** in
> [../ado-shared/REFERENCE.md](../ado-shared/REFERENCE.md). That file also holds the
> **Command Map**, **Quirks**, and **Error handling** rules. `{org}` = `organization`,
> `{project}` come from Step 0.

> **German installation — never assume English type/state names.** Our Server is German, so
> work item **types** and **states** are localized: `Task` → **Aufgabe**, `Bug` → **Fehler**;
> states like `New`/`Active`/`Closed` appear as **Neu**/**Aktiv**/**Geschlossen**. The exact
> names depend on the project's process template, so **fetch them from the server first**
> (Step 1 below) instead of guessing.

---

## Workflow: Work Item Management

**Trigger:** User asks to create, show, query, or update an Azure DevOps **work item**
(German: *Arbeitselement*), or `$ARGUMENTS` starts with `workitem` (e.g. `workitem create`,
`workitem show 1234`, `workitem update 1234`).

### Step 1 — Discover the localized types and states (do this BEFORE create/query/update)
Fetch the project's real work item types so you use the actual German names:
```bash
az devops invoke --area wit --resource workItemTypes \
  --route-parameters project={project} --org {org} --api-version 7.1 -o json
```
Use each type's `name` field (the localized display name, e.g. `Aufgabe`) — that is what
`--type` and WIQL `[System.WorkItemType]` values expect. If the `--resource` name is
rejected, discover the correct one with `az devops invoke --query "[?area=='wit']"` and
match the `routeTemplate`.

For state values, read the chosen type's localized states:
```bash
az devops invoke --area wit --resource workItemTypeStates \
  --route-parameters project={project} type={germanTypeName} --org {org} --api-version 7.1 -o json
```
Only fall back to an English guess if discovery genuinely fails — and tell the user you did.

### Create
1. Run **step 1**. If the user named a type in English (e.g. "task"), map it to the
   matching German `name` from the fetched list (`Aufgabe`). If there is no clear match,
   show the available types and ask which to use — do not invent one.
2. Gather: title (required), type, description, and optionally assignee, area, iteration,
   and a parent work item to link.
3. Create the work item:
   ```bash
   az boards work-item create --title "{title}" --type "{germanTypeName}" \
     [--description "{description}"] [--assigned-to "{user}"] \
     [--area "{area}"] [--iteration "{iteration}"] \
     --org {org} --project {project} -o json
   ```
4. **Optional — link to a parent:**
   ```bash
   az boards work-item relation add --id {newId} --relation-type parent \
     --target-id {parentId} --org {org} -o json
   ```
5. Report the new work item ID and URL. *(Per Quirks, an emoji in the title may be absent
   from the returned JSON — expected; the work item has it.)*

### Show / Query
- **Show one:** `az boards work-item show --id {id} --org {org} -o json`.
- **Query many (WIQL):** build the query with the localized values from step 1:
  ```bash
  az boards query --org {org} --project {project} -o json \
    --wiql "SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.WorkItemType] = 'Aufgabe' AND [System.State] <> 'Geschlossen' ORDER BY [System.ChangedDate] DESC"
  ```
  Field reference names (`[System.WorkItemType]`, `[System.State]`) are invariant English;
  the **values** (`'Aufgabe'`, `'Geschlossen'`) are the localized names from step 1.

### Update
1. Identify the work item (ID from the user, or via Show/Query above).
2. For a **state** change, get the valid localized states for its type from step 1 first.
3. Update only the fields being changed:
   ```bash
   az boards work-item update --id {id} [--title "{title}"] [--state "{germanState}"] \
     [--assigned-to "{user}"] [--description "{description}"] --org {org} -o json
   ```
4. Confirm the change and report the work item URL.
