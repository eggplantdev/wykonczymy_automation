# EX-448 — Stable per-row ids for expense line-items

- **Linear:** EX-448 (parent EX-443)
- **Status:** implementing
- **Updated:** 2026-07-18
- **Branch:** konradantonik/ex-448-stable-row-ids (off main; plan docs cherry-picked from S-07's 669e024b)

## Summary

Expense line-item rows use their positional array index as identity. Because the index
shifts on insert/remove, the code carries a reindex/remount apparatus (`reindexAfterRemoval`,
`reindexSet`, `onRowRemoved`, the `fileInputKey` remount) to keep out-of-form state (file map,
generation markers) aligned to moving rows. Give each row a stable client-side `id` at
creation, key that state by id, and retire the machinery — converting id→position only at the
submit boundary, where the positional `resolveInvoiceMediaIds` contract is load-bearing.

Rows are ephemeral form state — no persistence, schema migration, or backfill.
