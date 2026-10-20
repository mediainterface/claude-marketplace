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
- **Server facts are verified, not assumed** (localized names, HTML fields, the comments API
  version, `--assigned-to` by display name). Before changing one, check it against the server
  with a read-only `az` call.
