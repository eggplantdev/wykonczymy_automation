---
change_id: materials-price-list
title: Cennik materiałów budowlanych as an in-app page, ported from the claude.ai artifact
status: new
created: 2026-10-23
updated: 2026-10-23
archived_at: null
branch: null
worktree: null
---

## Notes

— Cennik materiałów budowlanych jako podstrona aplikacji (/inwestycje/materialy): ujednolicona lista materiałów z faktur i paragonów, porównanie sklepów, ceny i ilości, na wzór strony Trafność AI

**Spike** — no plan, first test version.

- Data is a static snapshot, `src/lib/materials/price-list.json`. It was produced once, outside the repo. The steps:
  1. Invoices and receipts from the preview Blob store were OCR'd and merged into materials (canonical product + pack).
  2. Odd packs were converted to the canonical pack.
  3. The result was exported with investment **ids** only. Names are client addresses, so they're resolved at request time from `fetchReferenceData()`.
- Refreshing the snapshot means re-running that one-off pipeline. A live source (from transfers/invoices in the DB) is the follow-up if the spike sticks.
