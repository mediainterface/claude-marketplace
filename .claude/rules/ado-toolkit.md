---
paths:
  - "plugins/ado-toolkit/**"
---

# ado-toolkit — what no single file states

- **Process-neutral by design.** No specs, 📝 markers or Memory Bank here; a calling skill
  layers its conventions on top through `/ado-pr`'s PR Creation step 7 (that is how
  `sdd-kit:spec-pr` works).
- **No mode without a git checkout**, also not for ticket-only teams — a deliberate decision,
  the checkout's `origin` picks the server and project.
- **`skills/ado-shared/REFERENCE.md` holds everything shared.** Do not repeat its content in a
  `SKILL.md`; link to it.
- **No server's names are hard-coded.** Types, states, fields and relation types come from the
  discovery cache (`ado-shared/REFERENCE.md`), because other teams run their own servers and
  projects with their own process. Values from `ado.mediainterface.de` appear only as examples.
- **Findings files are posted by `ado-pr/scripts/post_findings.py`, never by the model.** Their
  comment texts come from reviewing an unvetted PR; a model with `az` rights that reads them can
  be steered. The field table under **Post a findings file** and the script's `check()` change
  together. Review skills in other repositories write the format, so a breaking change raises
  `schemaVersion`.
- **Behavior facts are verified, not assumed** (HTML fields, the comments API version,
  `--assigned-to` by display name). Before changing one, check it with a read-only `az` call.
