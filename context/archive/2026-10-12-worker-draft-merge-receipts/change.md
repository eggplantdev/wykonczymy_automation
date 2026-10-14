---
change_id: worker-draft-merge-receipts
title: Merge and split paragon rows when accepting a worker's expense draft
status: archived
created: 2026-10-12
updated: 2026-10-14
archived_at: 2026-10-14T08:19:53Z
branch: worker-draft-merge-receipts
worktree: /Users/konradantonik/workspace/yolo/wykonczymy-worktrees/worker-draft-merge-receipts
---

## Notes

Linear: EX-1048

„Połącz” / „Rozłącz” rows in the worker zgłoszenie „Przyjmij” dialog; always read paragon by
paragon. „Jeden wydatek” is removed from the worker's dialog (owner, 2026-10-13) — the manager merges.

Trigger: zgłoszenie #13 (prod) — 13 Leroy Merlin paragony plus 24 parking bileciki on 7 photos.
Re-read paragon by paragon as #24 (`src/scripts/rescan-expense-draft.ts`): 37 rows, 1177.85 zł.
The owner wants the 24 bileciki booked as ONE transakcja. Today that only works with „Jeden
wydatek”, whose single-document read (`extractReceipt`) returned 257.50 zł / null / 286.90 zł on
three runs over the 3 ticket photos — the true sum is 287.90 zł. Summing in code is exact; asking
the model for one total over many documents is not.

Done only once it works AND is documented (owner, 2026-10-12): the change ships with its docs
updated — `context/foundation/test-plan.md` / `manual-checks.md` entries for zgłoszenia, plus any
doc still describing „Jeden wydatek” as a single-document read.
