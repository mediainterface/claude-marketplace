---
paths:
  - "plugins/ci-review/**"
---

# ci-review — what no single file states

- **The findings format is a contract with `ado-toolkit`.** The schema lives in
  `skills/review-shared/findings.schema.json`, the poster's own check in `ado-toolkit`'s
  `skills/ado-pr/scripts/post_findings.py` (`check()`) and its field table under **Post a
  findings file**. A new category only extends the schema's enum; a new severity, a changed
  anchor or a changed posting field changes both plugins. A breaking change raises
  `schemaVersion` in both — the poster refuses every version it does not know.
- **Each skill's `review.json` lists the checks its `SKILL.md` names.** Change them together;
  the validator fails a review log that misses or adds a check.
- **`validate_findings.py` implements only the JSON Schema keywords the schema uses** and stops
  on any other, so a schema that uses a new keyword needs the validator extended in the same
  change.
- **The skills run with `settingSources: []`** in the pipeline: no `CLAUDE.md`, settings or
  hooks of the reviewed repository are loaded. A skill reads the conventions it measures
  against itself, as data, and never relies on them being in its context.
- **Review skills post nothing.** No `az` in their `allowed-tools`; the pipeline posts with
  `ado-toolkit` after the run, without a model reading the comments. That is also why
  `plugin.json` declares no dependency on `ado-toolkit`: the SDK refuses to load a local plugin
  whose dependency is not loaded as well.
