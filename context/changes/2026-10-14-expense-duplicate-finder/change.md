---
change_id: expense-duplicate-finder
title: Universal expense duplicate finder with a „Szukaj duplikatów” dialog on transfers
status: implemented
created: 2026-10-14
updated: 2026-10-14
archived_at: null
branch: main
worktree: null
---

## Notes

Linear: EX-1026 (also closes the EX-1053 follow-up: duplicates inside one zgłoszenie).

Universal duplicate-detection engine for expense documents + „Szukaj duplikatów” dialog in the transfers toolbar. Decisions: candidates = booked transakcje AND pending zgłoszenia read rows (diagnostic only); results are links only (no actions, no dismissed-pairs table); first entry point = transfers toolbar (next to invoice download); results split into strong and weak (same-amount-only) groups. Engine reuses matchExpense (lib/expense-duplicates/match.ts) and replaces the narrow loading in findExpenseDraftDuplicates so the zgłoszenie dialog also catches duplicates inside one merged zgłoszenie (EX-1053 follow-up). Dialog follows the TelmakCheckDialog / InvoiceDownloadDialog pattern: scope + DateRangePicker → analyse → grouped results table.
