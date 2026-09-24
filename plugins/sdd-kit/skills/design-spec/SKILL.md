---
name: design-spec
description: >-
  Writes a story's design spec under docs/sdd/specs/ in the MIRA form — a compact,
  decision-centred document for the spec PR of the SDD workflow. Use when a refined
  work item is to be turned into a design spec, when the user asks to plan a story or
  write its spec, and whenever the superpowers brainstorming skill is about to write
  the spec document for a story. Covers the planning conversation before writing,
  the section order, what belongs in a spec versus the implementation plan, and the
  checks before sdd-kit:spec-pr.
argument-hint: <work item ID or URL>
---

# Design spec

A spec is a **transient review document**: it is merged in its own PR, guides the implementation
plan, and is deleted at the human review of the implementation PR. It is read side by side in a
diff by reviewers who know the codebase. Optimise for that reader: decisions first, reviewable
line by line, nothing a reviewer cannot check.

## Workflow

1. **Read before talking.** The work item (description and acceptance criteria), its parent epic
   and sibling stories, the predecessor's spec if one is still in the repo (`docs/sdd/specs/`,
   older ones under `docs/superpowers/specs/`), the affected code, the Memory Bank levels
   involved (`docs/decisions/`, `apps/<app>/docs/`, `services/<svc>/docs/`) and the repo's test
   process if it defines one. Fetch the work item through `sdd-kit:ado-workitem`; it should be in
   the **Refinement** state — if not, say so, do not change it.
   - *Siblings:* do not build what a sibling plans, but leave the hook it will need where it
     costs nothing now (an id kept on a view, a union typed to grow) and name the hook in Out
     of scope with the sibling's id.
   - *Predecessor:* restate only what makes this spec readable alone; an interface the
     predecessor fixed is "implemented here", not argued again.
2. **Discuss first, write second.** Start with the premise: in two sentences, what is wrong or
   missing today, since when (`git log -S`), and whether it ever shipped — and have the user
   confirm it before any single decision. A wrong premise rewrites the whole spec later. Then lay
   out the implementation approach in a few sentences and list the decisions the user has to
   make — contradictions in the acceptance criteria, gaps, choices between alternatives. Ask them
   directly; do not park them as open questions. Acceptance criteria that turn out wrong are
   corrected in the work item (with the user's OK), not silently reinterpreted.
   If the superpowers `brainstorming` skill is already running, its conversation is this step;
   the document it writes follows the form below instead of its own template.
3. **Write the spec** in the form below, English, hard-wrapped at 100 characters (tables,
   code blocks and single long links excepted), file
   `docs/sdd/specs/YYYY-MM-DD-<app>-<topic>-design.md` at the repository root, never on an app
   level. Branch `spec/<id>-<topic>`.
4. **Check** wrap length, that every relative link resolves, that a decision changed during the
   discussion left no old wording behind (search the whole spec for it — edge cases, tests and AC
   coverage keep stale copies longest), and that everything needed beyond the story is captured
   outside the spec (inline reasons listed, work item updated, a record or convention only if the
   `sdd-kit:create-decision` / `create-lesson-learned` triage says so).
5. **Hand over to `sdd-kit:spec-pr`.** No implementation plan, no code.

## Form

### Frontmatter — two bullets, nothing else

```markdown
# <App(s)> — <Feature>: <Story title> (US #<id>) Design Spec

- **Work items:** [#<id> <title>](<ADO URL>), epic [#<id> <title>](<ADO URL>).
- **Apps / services:** `apps/<app>`, `services/<svc>`.

---
```

No date, no status, no test depth, no "builds on", no work-item state, no descriptions behind
the app names. The spec is deleted after implementation; the state changes after merge; the
reasons belong in the body.

### Sections, in this order

| § | Section | Content |
|---|---|---|
| 1 | Context | Three to five sentences: what exists, what is missing, what this story adds. No history, no merge status. |
| 2 | Decisions | **The core.** One table `Topic \| Decision \| Why` with every choice between alternatives and every deviation from the story's wording. Mark what the user confirmed. |
| 3 | Out of scope | One paragraph naming the sibling stories by id and what stays out. |
| 4 | Data / content model | *Optional.* The stored shape and its rules. |
| 5 | Backend | *Optional.* Request/response as a code block, rules as bullets. |
| 6 | Client — contract and main | *Optional.* Messages across the process boundary, what main owns. |
| 7 | Client — UI | *Optional.* One bullet list per surface. |
| 8 | Errors | Table `Situation \| Kind \| User sees`. |
| 9 | Edge cases | Table `Case \| Behaviour`. |
| 10 | Tests | Depth justification in one sentence against the repo's test process, then bullets per test level as that process names them and the repo actually runs them, AC coverage as one paragraph of section references. |
| 11 | Memory Bank | Governing decision records and conventions (followed, none changed), new records as the sdd-kit skills decided them, and the **list of reasons to carry inline** into the code. |
| 12 | Delivery | PR split as a table (see below). |

Drop the optional sections the story does not need and renumber; the order stays.

### Checklists for the domain sections

Answer each point that applies; leave out the rest silently.

- **Data model:** for every derived or defaulted value, whether an explicitly supplied value
  always wins over the inference, and whether a validation built from that inference could
  refuse a deliberate choice it would have classified differently.
- **Backend:** request and response shapes; validation and bounds; error codes mapped onto the
  codebase's existing patterns (which exception, which error type); authorization ladder;
  audit; what the endpoint deliberately does not do (a field that is not updatable);
  compatibility with older clients still on the API (additive schema only, untouched routes);
  version skew between services during a rolling update in both directions — old producer with
  new consumer and the reverse — including a non-nullable enum silently taking its default when
  the field is missing.
- **Client contract and main:** the message shapes across the process boundary, closed error
  unions, what main resolves itself and never trusts the renderer with.
- **UI surface:** entry points and the way back; focus on enter and on leave; keyboard route
  through and out; what a screen reader is told and when; forced-colors safety; dirty state and
  its guards (leave, sign-out, quit); what the surface deliberately does not offer yet.
- **Edge-case dimensions:** another client changes the same data meanwhile; language or
  culture switches while open; session ends, sign-out, window close; views that stay mounted
  while hidden; casing and collation; empty and whitespace-only values; the same thing twice.

### Tests follow the repo's test process

If the repo defines a test process (a process document, a test strategy per app), the tests
section is written against it: its test levels, its depth classes and what each class demands
and forbids (a new end-to-end journey, a contract test for a new API, a statement on critical
paths), and which existing suites are extended rather than duplicated. Name what the depth
excludes as clearly as what it requires. Without such a process, state the levels used and why.

Plan only against test levels and mechanisms the repo **actually runs** — a level the process
names in the abstract but nobody has built is not a bullet; introducing a new test mechanism is
a decision of its own, not a line in a story's spec. Use the process's terms by their definition
(read it before writing "Green Path", "contract test", "extended"): a term that sounds right but
means something else there is the finding a reviewer will make.

### Memory Bank triage

Whether a decision or insight becomes a record is **always** decided through the
`sdd-kit:create-decision` / `sdd-kit:create-lesson-learned` skills and their shared reference
([`../memory-bank-shared/REFERENCE.md`](../memory-bank-shared/REFERENCE.md)) — run them for
every candidate, never judge by hand, and do not restate their criteria here. The spec records
only the outcome: governing records and conventions as followed (a spec applies them, it does not
restate them), new records with the skill's verdict, and the list of reasons that go inline into
the code instead.

### Delivery

Split into PRs that are each green and shippable on their own, at most about 30 files each;
give the order and what can run in parallel. Name what this spec PR itself removes (a
predecessor's spec or plan left behind). The spec and its plan are deleted in the review round
of the **last** implementation PR, never in a spec PR.

## Rules

- **Spec, not plan.** No file names, component or hook names, test ids, CSS classes, query
  keys. Name a thing only when the reviewer has to find it (an endpoint, an entity, a contract
  constant, an index). Everything else is the implementation plan's business.
- **Bullets and tables over prose.** A reviewer comments per line. Prose only where a
  trade-off is argued (why A and not B); one paragraph per trade-off.
- **Claims about today are checked.** Every "unchanged", "as today" or "existing behaviour" is
  backed by the code, not by memory; every behaviour that is new appears as work in Delivery.
- **One rule, one place.** State a rule once and refer to it elsewhere; never restate it in own
  words or as a count ("runs at two places") — restatements drift apart with the next change.
- **Justify the non-obvious only.** No sentence explaining why a toast, why an encoded id, why
  a test exists. The `Why` column carries the reasons that could be challenged.
- **Reference decision records by filename**, conventions by rule name, sibling stories by id.
  Never reference a spec or plan from code; from a spec it is fine while both exist.
- **Copy stays out.** Where a message carries a decision, describe what it tells the user and
  name it by its internal key; the wording and its translations are written with the
  implementation, where the localization rule demands them.
- **Known defects carried knowingly** get a named follow-up work item and appear three times:
  in the decisions table, at the surface they affect, and in the inline-reasons list.
- **Length target:** 200 to 300 lines for a story touching client and backend; a single-app
  story is shorter. Past 350 lines, look for plan detail and repetition first.
- **English only.** The one exception is a work-item title inside its link. Never quote
  localized UI copy: refer to a control, view or message by its internal English name (the
  translation key, the component's role, the error kind) — the localization is the
  implementation's concern, not the spec's.
