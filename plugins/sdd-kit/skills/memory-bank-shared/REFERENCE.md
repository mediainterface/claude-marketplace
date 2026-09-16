# Memory Bank — shared reference

Shared definitions for the Memory Bank skills
([create-decision](../create-decision/SKILL.md),
[create-lesson-learned](../create-lesson-learned/SKILL.md)). This file is
**not** a skill — the skills link here so the policy exists exactly once.

## Levels

A Memory Bank **level** is a directory subtree with its own
`docs/decisions/` and `docs/learnings/`, each with its own `README.md`
index.

- The **repo root** is the suite level: decisions spanning multiple
  apps/services, process decisions, repo-wide baselines.
- **`apps/<app>/`** and **`services/<service>/`** are app levels: records
  that concern only that app or service.
- There is **no hard-coded list of levels.** Any directory becomes a level
  when the placement rule selects it — e.g. `services/` for a decision
  affecting several backend services. This keeps the skills repo-agnostic;
  a repo whose records all live at the root simply has one level.

## Placement rule

> A record lives on the smallest level whose subtree contains everyone affected.

Spanning multiple apps or services / process / repo-wide baselines → repo
root. Anything that affects a single app → that app's directory — **even
when it spans several features inside that app** (the cross-cutting
criterion can be met by a feature-spanning decision; significance and
placement are independent questions). Several sibling services → their common parent
(e.g. `services/`).

## Delta principle

A record that specializes or deviates from a record on a higher level
**links that record** in its *Context and problem* section. Never duplicate
higher-level content on a lower level.

## Before creating: check the other levels

A new record starts with a search, not a template: check the proposed
level, every level above it, and sibling apps/services for an existing
record on the same topic. A hit on a higher level is specialized via the
delta principle instead of restated; a hit in a sibling means the topic
is broader than one app — promote it (see below) instead of duplicating
it.

## Promotion

When a record turns out to matter beyond its level (e.g. a sibling app
faces the same question), do not move the file. Create a new record on
the smallest level that covers everyone now affected, and set the old
record's status to `Superseded by <new record's filename without .md>` —
the same supersede mechanism used for any revised decision.

## Significance triage

This section is the **single source of truth** for the gate. The Memory Bank
process document (`docs/processes/memory-bank/memory-bank.md`) points at this
skill instead of repeating the criteria — deliberately, so they are not
maintained in two places and cannot drift apart. Changes to the criteria or
the exclusions are the **Hüter-Trio's** call and land as a change to this
file.

A decision deserves a Decision Record only if **at least one** criterion
applies **and no exclusion** does:

1. **Hard to reverse and expensive to change** — the stack, a load-bearing
   library, a stored data format, the build or distribution mechanism.
2. **Eases the team's future decisions** — a rule the next feature applies
   without deciding the question again.
3. **Product decision to be protected** from being silently rolled back.
4. **Breaks an existing pattern.**
5. **Cross-cutting** — it shapes several features durably, and different
   implementations would behave differently for the user.

### Exclusions

An exclusion **overrides a ticked criterion**. The criteria are or-ed; the
exclusions are not:

- It concerns **only one feature** and has no effect on others.
- It changes nothing about **appearance, stability, behavior, or developer
  experience**.
- It is a **detail that touches the whole app** but is neither a product
  decision nor hard to revise.

### Evidence required

A criterion is met only when its evidence can be **named** — in one line,
concretely, from this codebase. Without a nameable piece of evidence the
criterion is **not** met, however plausible it reads:

| Criterion | Name this |
|---|---|
| Hard to reverse | what a **revert costs** (files, migrations, released data, other teams) — and which of stack / library / data format / build mechanism it is. |
| Eases future decisions | the **next case** the rule would decide without re-deciding. "Someone will need this" does not count. |
| Product decision | what the **user notices**, and who would roll it back unknowingly. |
| Breaks a pattern | which **existing pattern** it breaks. An interface that follows the project's established pattern (a feature slice, the usual IPC/route layout) *applies* an existing decision — it does not break one. |
| Cross-cutting | the concrete **features / apps / teams** shaped by it, and how a different implementation would behave differently for the user. |

If no criterion applies — or an exclusion bites — **no Decision Record** is
created. Route instead:

| What it actually is | Route |
|---|---|
| Recurring "how we write code" rule | Convention in `.claude/rules/` (written manually: short rule + example + optional `paths:` frontmatter) |
| Observation / pitfall | `/create-lesson-learned` |
| Project-level instruction (structure, commands, conventions of a subtree) | The `CLAUDE.md` of that level |
| One-off local design choice | Inline in the code, as its own reason — no record |

**The spec is not a storage location.** A design spec and an implementation
plan are transient — they are deleted at the human code review of the
story's implementation — and a PR
description is only read while its PR is open. So a local design choice that
still needs a durable trace belongs **inline in the code it explains**, never
in the spec alone. Anything that is needed beyond the story and does clear the
triage becomes a record before the spec goes away.

### When the gate is genuinely unclear: ask the Hüter first

A record is **binding the moment it exists**, and undoing one costs a second
record that supersedes it — an entry in the Memory Bank that only documents
that the first one should not have been written. So an uncertain record is
more expensive than a late one.

The gate itself decides most cases: a criterion whose evidence cannot be
named is **not met**, and the routing table above then applies. Do **not**
escalate a weak case — that is simply a "no record", with the reason inline in
the code.

Escalate only when the outcome is genuinely undecidable **after** the evidence
has been named — the evidence holds but an exclusion seems to fit too, or the
criterion depends on a plan nobody has committed to yet (the "second app"
being discussed but not started). In that case: **do not create the record and
do not decide it away.**

A skill **cannot involve the Hüter-Trio itself** — it has no way to reach
them. What it does is hand the case to the user and **stop**:

1. Name the decision, the criterion, and the evidence on **both** sides — what
   speaks for the record and what speaks against it — in a few lines the user
   can forward as they are.
2. Ask the user to put exactly that question to the Hüter-Trio.
3. **Stop there.** The run ends: no record, no partial file, no "I'll write it
   and we can revert it". Say plainly that the skill is paused until the answer
   is in, and that it can be invoked again then.
4. The reasoning stays inline in the code in the meantime, where it is durable
   and costs nothing to move into a record later.

Waiting is cheap — the inline reason already carries the "why" — while a
record written to avoid the wait is binding and needs a second record to undo.

The criteria and the exclusions are fixed (like the category list) and changed
only by the Hüter-Trio, here in this file. Two further things are **team
decisions**: **declining** a proposed record, and **deleting or merging**
existing records — never something a skill does on its own. Lessons Learned
have **no** significance gate; they are deliberately low-threshold.

### Form rules for a record

A record that passes the gate still has to hold its form. These rules are
checked against the finished file:

- **Under 80 lines** in total (the file, not the line width — prose is
  wrapped at 100 characters, see **Line length** below).
- **No amendments.** A changed decision is superseded by a new record, it is
  not appended to.
- **No spec content** — no measurements, thresholds, rule catalogs, or
  mechanics. Those belong in the code, a convention, or the story.
- **No links to work items, PRs, specs, or plans.** All four are transient
  or only readable in context; the record outlives them.
- **No justification prose.** The decision and its consequences, not an essay
  defending them.
- **The record stands on its own.** Cross-references only where two decisions
  genuinely interlock (the delta principle above being that case).

### Examples

**No record** — formally tickable, still excluded: a settings field records the
key combination the user presses in order to assign a hotkey, and while it
records, the app's global hotkeys are suspended so they don't fire instead of
being captured. Claimed *breaks a pattern* (the feature adds two IPC
channels) and *eases future decisions* (future key-capture fields should
suspend them the same way). Neither survives the evidence question: the
channels follow the app's established feature-slice pattern, so they apply an
existing decision instead of breaking one, and there is exactly **one** such
field today — the next case was speculation, not a case. The first exclusion
bites as well: one feature, no effect on others → an inline reason in the code.

**Record** — cross-feature communication runs through an owner-side bridge
store. *Breaks a pattern*: it replaces the direct store imports features used
before. *Cross-cutting*: toolbar↔editor and session-list↔player both exist
today, both have to follow it, and a feature wiring itself up differently
would behave differently for the user.

### Where the triage runs

The triage runs where a record is **first proposed** — including a spec's
*Memory Bank* section, not only when `/create-decision` creates the file. A
spec proposal states the criterion **with its evidence**; a record already
written out in a spec makes the later gate a rubber stamp.

### Generalize

When a decision passes because it **eases future decisions** or is
**cross-cutting**, record the generalizable pattern, not the single instance
("cross-feature communication via an owner-side bridge store", not "the
toolbar↔editor store"). The second application of an established pattern gets
no new record — it follows the existing one.

## Line length

Every file these skills write — records, learnings, and the `README.md`
indexes — is hard-wrapped at **100 characters**, at word boundaries.
Endless lines force horizontal scrolling in the one place these files are
actually read: the side-by-side diff of a review.

Not wrapped: table rows (the indexes), fenced code blocks, frontmatter
values, and a single long URL. Never reflow an existing record wholesale —
wrap the paragraphs you edit anyway, so the diff shows the change instead
of the reformat.

## Boundaries

- **Conventions stay central** in the repo-root `.claude/rules/` — a
  deliberate policy, not a technical limit: a nested `.claude/rules/`
  would load only on demand per subtree (like a nested `CLAUDE.md`),
  which we avoid for conventions that must be in scope suite-wide in
  every session. Their scoping is the `paths:` frontmatter, not the
  directory location.
- Skills **never move existing records** between levels. Migrating legacy
  records is a project of the affected repo, not a skill action.
- Every level maintains **only its own index** (`README.md`); never
  aggregate indexes across levels.
