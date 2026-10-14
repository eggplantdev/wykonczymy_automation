---
change_id: worker-draft-one-expense-per-photo
title: Worker expense drafts read every paragon on each photo
status: archived
created: 2026-10-12
updated: 2026-10-14
archived_at: 2026-10-14T17:34:59Z
branch: staging
worktree: null
---

## Notes

Worker expense drafts default to one expense per photo; „Jeden wydatek” stays behind a confirm
dialog. A pending draft can only be deleted — adding/removing photos on a sent draft is gone. The
AI read of a photo returns every separate document on it (`extractReceipts`), so a photo of four
paragony laid side by side becomes four rows, and a skipped row is identified by
`{ mediaIds, readRow }` (migration `20261012_1_add_skipped_receipt_read_row`, additive — migrate
prod before the push).

Evidence (prod dump 2026-10-12): 0 multi-page invoices ever photographed as separate images; the
only multi-photo worker draft (#13) was 13 separate Leroy Merlin paragony merged into one 1058.05 zł
row.

Live eval: `pnpm test:receipts-ai` reads 15 real photos (gitignored `dumps/receipt-eval/`, copied
from `dumps/blob-mirror/`) against the paid model — 15/15 on three consecutive runs, 2026-10-12.
The photos with several paragony come mostly from managers, through the management expense form,
whose „Generuj” still reads one document — that rebuild is a separate change.
