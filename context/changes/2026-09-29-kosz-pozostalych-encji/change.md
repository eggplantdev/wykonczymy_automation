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

## Decisions (2026-09-30)

- **Order changed: Kasy → Pracownicy first; Flota / Sprzęt last.** Flota and Sprzęt are not in real
  use on prod yet, so they are the lowest priority, and building them first would not make kasy or
  pracownicy easier: the hard parts there (the name-map split in `fetchReferenceData`, the auth gate,
  entity tags) do not exist in fleet or equipment. The shared prep — the `TRASH_KINDS` table from the
  EX-914 review note on EX-915, and moving `TRASH_RETENTION_DAYS` out of `investment-lock.ts` — lands
  in Kasy (EX-917) instead, as the second kind in the trash.
