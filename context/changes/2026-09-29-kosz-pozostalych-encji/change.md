---
change_id: kosz-pozostalych-encji
title: Trash for the remaining entities — fleet, equipment, workers, registers, hard-deleted kosztorys records
status: preparing
created: 2026-09-29
updated: 2026-09-29
archived_at: null
branch: null
worktree: null
---

## Notes

Umbrella research for extending `/kosz` beyond investments. Split into one change per entity kind —
see `research.md` § 8.

## Decisions (2026-09-29)

- The hard-deleted thing that goes to the trash is **Szablony kosztorysów** — not Kosztorysy v1, not
  Zgłoszenia.
- Trash = mistaken / never-used entries only; `active` and lifecycle statuses stay for retiring
  something with history.
- MANAGER has full parity on every new trash section.
- Order: Szablony → Flota → Sprzęt → Kasy → Pracownicy, each its own change.
