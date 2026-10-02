---
change_id: kosztorys-section-translations
title: Translate kosztorys section names (UA/RU) on the worker report link
status: implemented
created: 2026-10-02
updated: 2026-10-02
archived_at: null
branch: kosztorys-section-translations
worktree: ../wykonczymy-worktrees/kosztorys-section-translations
---

## Notes

EX-965: translate kosztorys section names (UA/RU) on the worker report link; etapy stay untranslated (owner 2026-10-01)

### Decisions

- **A manager can fix a section's translation in the app (user, 2026-10-02).** That rules out a
  code-side file per language, because fixing it would need a deploy. The translations live in the
  database and have an editing surface.
- **One shared list, keyed by the normalised Polish name (user, 2026-10-02).** One entry per name
  (`lower` + `trim` + collapsed spaces + number placeholder), one translation per language. Fixing
  „Kuchnia" changes it on every rozpiska, future ones included. Nothing is stored on the section row,
  so the copy paths (restore, szablon, import, snapshot) stay untouched. A rename just looks up the
  new name. There is no "out of date" state. A miss shows in Polish.
  - The old and new szablon spellings each get their own entry. Cleaning up the old rows is not part
    of this change.
- **Edited from the section menu, „Tłumaczenie sekcji…" with UA and RU fields (user, 2026-10-02,
  /10x-plan).** There is no list page. The manager types real numbers. On save, the numbers must equal
  the name's, in order, or the save is refused.
- **No „bez tłumaczenia" problem in „Problemy" (user, 2026-10-02, /10x-plan).** It follows EX-948's
  reasoning for opisy: most rozpiski never reach a UA/RU crew.
- **The first translations are seeded by the migration and never overwrite an existing entry (user,
  2026-10-02, /10x-plan).** There is no fill script. A later name is filled in the dialog.
- **The report link only (user, 2026-10-02, /10x-plan).** `/p`, „Podgląd pracownika" and the PDF go
  to EX-966 on the same lookup.
- **A standalone number anywhere in a section name is a placeholder (user, 2026-10-02).** „Łazienka 1
  wanna" and „Łazienka 2 wanna" share the key `łazienka # wanna`, and the number is put back in place
  in the translation. A number glued to letters („230V") is part of the text.
