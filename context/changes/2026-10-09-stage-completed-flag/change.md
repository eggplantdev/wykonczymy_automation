---
change_id: stage-completed-flag
title: Etap „zakończony" flag — hides finished etapy from the worker and colours them
status: implemented
created: 2026-10-09
updated: 2026-10-09
archived_at: null
branch: stage-completed-flag
worktree: ../wykonczymy-stage-completed
---

## Notes

Linear: EX-1034. Shaped with the user 2026-10-09:

- New „zakończony" flag on an etap, toggled by MANAGER and up, reversible.
- **Per worker:** an investment stays on a worker's list (zgłoszenie prac links, zgłoszenie wydatku
  picker, the kierownik's skan-zgłoszenia worker picker) while he has at least one niezakończony
  etap on it. All his etapy zakończone → the investment drops off, as if it were not aktywna.
- **No reporting onto a zakończony etap:** the report form hides it and the server refuses new
  lines for it, so a bookmarked link does not get around the list. Zgłoszenia sent before the etap
  was closed can still be accepted.
- **No lock:** quantities on a zakończony etap stay editable in the kosztorys.
- **Colour:** a zakończony etap gets a distinct „finished" colour on its column header and cells in
  every view — the manager's editor, podgląd inwestora / share link, podgląd pracownika. Colour
  choice left to the implementer.
