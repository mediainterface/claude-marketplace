# Memory Bank triage gate and multi-level scoping — design

**Date:** 2026-07-21
**Status:** Approved (design review with Marcel, 2026-07-21)
**Scope:** sdd-kit and guardian plugins in this repo. The migration of the existing
Mira Memory Bank (moving ~35 desktop records, updating the concept document) is a
**separate follow-up project** in the Mira repo and explicitly out of scope here.

## Problem

The Memory Bank (decisions + learnings, maintained via `/create-decision` and
`/create-lesson-learned`) suffers from two independent weaknesses, confirmed by
classifying all 40 existing Mira decision records:

1. **No significance filter.** The `/create-decision` skill accepts *any* decision,
   so implementation details (e.g. `0036-cross-feature-editor-command-bridge-store`,
   a single Zustand store between two components) and coding conventions (e.g.
   `0038-icon-only-buttons-circular`) end up as decision records. The skill also
   *proposes* records too eagerly, because its description triggers on "any decision".
2. **No scope mechanism.** All records land in the repo-root `docs/decisions/`,
   although 37 of Mira's 40 decisions govern only `apps/mira-desktop`. Conventions
   already have a scoping mechanism (`.claude/rules/` with `paths:` frontmatter);
   decisions and learnings have none.

Research basis (adversarially verified against primary sources): Nygard's five
significance dimensions (adopted by AWS Prescriptive Guidance), Microsoft WAF's
"structure / key quality attributes / hard to reverse" filter, arc42's "important,
expensive, large scale or risky" + central-vs-local placement judgement, Zimmermann's
seven-criterion significance test and ~100-entry log-size ceiling, MADR's category
subdirectories, and Hackney's federated central-log + per-application-delta model.

## Goals

- `/create-decision` refuses non-significant records (hard gate) and routes them to
  the right artifact instead.
- Decision records and learnings are placed on the correct **level** (directory
  subtree) of the repo, chosen by a single generic placement rule.
- Claude applies the significance criteria already when *proposing* records during
  spec work, not only inside the skill.
- The guardian review skill sees records on all levels and flags likely misplacements.
- Everything stays repo-agnostic (works in any MediaInterface repo, not just Mira)
  and backward-compatible with repos that only have root-level directories.

## Non-goals

- Migrating Mira's existing records or updating Mira's
  `docs/processes/memory-bank/memory-bank.md` concept document (follow-up project in
  the Mira repo, which follows the SDD workflow).
- Deciding what happens to the three convention-candidate records
  (0022, 0023, 0038) — that is a Hüter-Trio question.
- A significance gate for learnings — learnings stay deliberately low-threshold.
- A `scope:` frontmatter field — the directory location encodes the scope; a field
  would be redundant and could drift.

## Design

### 1. Shared reference: `plugins/sdd-kit/skills/memory-bank-shared/REFERENCE.md`

A non-skill reference file (same pattern as `ado-shared/REFERENCE.md`) linked by
relative path from `create-decision` and `create-lesson-learned`. Content:

- **Levels.** A Memory Bank level is a directory subtree with its own
  `docs/decisions/` and `docs/learnings/` (each with its own `README.md` index).
  The repo root is the suite level; `apps/<app>/` and `services/<service>/` are
  app levels. There is **no hard-coded list of levels** — intermediate levels
  (e.g. `services/` for backend-wide decisions) fall out of the placement rule.
- **Placement rule (one line):** *A record lives on the smallest level whose
  subtree contains everyone affected.* Cross-cutting / process / repo-wide
  baselines → repo root; anything affecting a single app → that app's directory.
- **Delta principle** (Hackney model): an app-level record that specializes or
  deviates from a suite-level record links it in its Context section. Never
  duplicate suite-level content on app level (arc42: avoid redundant texts).
- **Significance triage** (the four criteria, see §2) including the routing table.
- **Boundaries:** Conventions stay central in `.claude/rules/` (auto-loading only
  works there; their `paths:` scoping already exists). The skills never move
  existing records between levels; migrating legacy records is each repo's own
  project. Each level maintains only its own index — the skills never aggregate
  indexes across levels.

### 2. Hard significance gate in `/create-decision`

New step immediately after determining the repo root, **before** gathering any
information. The gate judges the decision as understood from the conversation
context (the skill is usually invoked right after a decision was made); if the
skill is invoked without enough context to judge, it first asks for the decision
in one line, then applies the gate. A record is created only if **at least one**
criterion applies:

1. **Structural impact** — affects structure, interfaces, dependencies, or quality
   attributes (security, performance, accessibility, …) — Nygard/AWS/Microsoft.
2. **Hard to reverse** — undoing it would be expensive or risky — Microsoft/arc42.
3. **Precedent** — a first-of-a-kind pattern future code should follow — Zimmermann.
4. **Cross-cutting** — spans features, apps, or teams — Zimmermann.

If none applies, the skill **refuses to create the record** (hard gate) and routes
instead, naming the reason:

| What it actually is | Route |
|---|---|
| Recurring "how we write code" rule | Convention in `.claude/rules/` (skill briefly explains format + `paths:`; created manually, as the Memory Bank concept prescribes) |
| Observation / pitfall | `/create-lesson-learned` |
| One-off local design choice | Stays in the spec / PR description — no record |

Like the category list, the criteria are fixed and changed only by the Hüter-Trio;
the skill does not create a refused record on insistence — disagreements go to the
Trio.

**Generalization guidance:** document the generalizable core (the pattern / the
precedent), not the instance — "cross-feature communication via an owner-side
bridge store", not "the toolbar↔editor store". The second application of an
established pattern gets no new record.

**Narrower skill description:** the frontmatter description changes from "when any
decision needs to be documented" to triggering on significant decisions
(technology/structure choices, baselines, precedents), keeping the existing trigger
phrases. This curbs over-triggering at the source.

### 3. Scope step and level-relative paths

**`create-decision/SKILL.md`** — new flow:

1. Determine repo root *(existing)*
2. **Significance gate** *(new, §2)*
3. **Determine scope** *(new)*: derive from conversation context which apps/services
   are affected → propose the smallest covering level (e.g. "only affects
   mira-desktop's editor → `apps/mira-desktop/`"); the user confirms or corrects.
   If the scope is not apparent from context, **ask — never guess.**
4. Gather information *(existing, unchanged)*
5. Create file at **`<scope>/docs/decisions/YYYY-MM-DD-kebab-case-title.md`**,
   creating the directory if needed *(naming scheme unchanged)*
6. Maintain the index **`<scope>/docs/decisions/README.md`** *(existing logic,
   path now level-relative; create with table header if missing)*
7. Confirmation *(existing, plus the chosen level is shown in the summary)*

The record **template is unchanged** (no `scope:` frontmatter). The delta principle
lives as guidance in the REFERENCE, not as a mandatory template field.

**`create-lesson-learned/SKILL.md`**: same scope step (as its new step 2), path
`<scope>/docs/learnings/`, index there. No significance gate. Its existing
redirect hints (rule → convention, decision → `/create-decision`) stay.

### 4. SessionStart hook: `sdd-policy.md` addition

New compact section (~10 lines) "Memory Bank records: significance & placement":
short form of the four criteria + the placement rule + a pointer to
`/create-decision` for details. This makes Claude filter at *proposal* time during
spec work, before any skill is invoked — which is where the over-proposing pain
actually occurs. The section is deliberately a summary; the REFERENCE stays the
source of truth for details.

### 5. Guardian `memory-bank-changes` skill

- The git-log scan covers `docs/decisions/` and `docs/learnings/` directories **at
  any depth** (pathspec globs) instead of root-only; `.claude/rules` unchanged.
- The "What counts as the Memory Bank" table and the report's `scanned:` header
  reflect the levels actually found.
- **New guardian flag:** a suite-level record whose content names only a single
  app/component (or vice versa) → possible misplacement, review placement.
- `guardian/README.md` updated accordingly.

### 6. `ado-pr/SKILL.md` spec-only detection

Line ~79 generalized: spec-only means only files under **any** `docs/` directory
(repo root or nested, e.g. `apps/*/docs/`, `services/*/docs/`) changed and no
source code.

### 7. Versioning and repo docs

Minor version bump for `sdd-kit` and `guardian` in their `plugin.json` and in
`.claude-plugin/marketplace.json`. Update the repo `CLAUDE.md` plugin sections
(the claude-md-improver hook checks this at commit time anyway).

## Error cases

- Scope not derivable from context → ask, never guess.
- Target directory missing → create it, including a fresh `README.md` index with
  the table header.
- Filename collision (same title, same day — now checked per level) → make the
  title more specific (existing rule).
- Repo without nested levels → globs match only the root; guardian and skills
  behave exactly as today. **Backward compatible, no migration required.**

## Verification (scenario dry-runs before the PR)

1. **Gate catches:** a 0036-like case (feature-internal store, but a precedent) →
   record created, on the app level. Counter-case: a 0038-like case (circular
   icon buttons) → gate refuses, routes to "convention".
2. **Scope correct:** a backend-spanning case (0031-like) → lands on the
   `services/` level; a process case (0026-like) → repo root.
3. **Learning scoping:** an EF-Core-like learning → `services/…/docs/learnings/`.
4. **Guardian:** in a test repo with records on two levels, `/memory-bank-changes`
   reports both and flags a deliberately misplaced suite-level decision.
5. Skill edits follow `superpowers:writing-skills`; completion claims only after
   `verification-before-completion`.

## Design decisions made during review

- **Two sub-projects, plugin first** — stops the inflow of misplaced records before
  the Mira migration.
- **This repo does not follow the SDD spec-PR workflow** (GitHub origin; Marcel
  opted out) — spec → plan → implementation directly.
- **Hard gate** (not soft) — the skill refuses and routes; overrides go through the
  Hüter-Trio.
- **Approach C** — shared REFERENCE.md plus the SessionStart-policy summary, so
  filtering happens at proposal time.

## Addendum (final review, 2026-07-21)

The whole-branch review found a gap no numbered design section covered (§6
generalized `ado-pr`'s spec-only *detection*, but `spec-pr`'s *staging* step
was missed): `spec-pr`'s Step 5 staged only the
root `docs/` (`git add docs/`), which would silently drop Memory Bank items
created on a nested level from the spec PR. Fixed on this branch: Step 5 now
stages the files created in its Step 3 by explicit path. The Mira follow-up
project should not inherit the root-only assumption anywhere it stages or
scans `docs/`.
