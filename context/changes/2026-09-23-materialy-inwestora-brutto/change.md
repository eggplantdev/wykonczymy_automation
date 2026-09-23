---
change_id: materialy-inwestora-brutto
title: Materiały w widoku inwestora — kategorie bez podziału na netto, lista wydatków tylko brutto
status: implementing
created: 2026-09-23
updated: 2026-09-23
archived_at: null
branch: zamrozone-brutto-wydatku-netto
worktree: null
---

## Notes

Research: `research.md` — start at its **Start here** section (decisions, open questions, next step).

Request (2026-09-23), Podsumowanie → Materiały, **investor view only** (`/k/<token>`, „Podgląd dla
inwestora"); the manager view stays as it is:

1. „Wydatki inwestycyjne" — no separate „Materiały wykończeniowe netto" row; only the categories
   (budowlane / wykończeniowe / pozostałe) and Razem.
2. The wydatki list — no brutto / netto split; brutto prices only.

Builds on `2026-09-23-zamrozone-brutto-wydatku-netto` (a netto row now carries its invoice brutto,
`recordedGross`), which this change needs.
