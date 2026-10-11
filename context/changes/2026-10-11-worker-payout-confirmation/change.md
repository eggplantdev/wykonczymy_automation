---
change_id: worker-payout-confirmation
title: Worker confirms receiving a wypłata before it is accepted
status: implemented
created: 2026-10-11
updated: 2026-10-11
archived_at: null
branch: null
worktree: null
---

## Notes

Linear: EX-1042 — open owner questions live there.

A manager books a wypłata, the worker confirms the amount on his own `/pracownicy/[id]`, and only
then is the transaction accepted. Needs a lifecycle status on the wypłata (pending → accepted).

Scope (user, 2026-10-11):

- A status on the wypłata, plus the date the worker accepted it.
- The worker can also reject it: the confirmation dialog then requires a written reason, which
  management sees as its own column on the „Wypłaty" page. Statuses: pending → accepted | rejected.
- The reject dialog follows the cancellation dialog (`cancel-transfer-button.tsx`): a required
  reason textarea with the min/max length counter, confirm disabled until it is valid. The
  worker-facing copy is translated (pl/uk/ru); the cancellation dialog's is Polish-only.
- A „Wypłaty" page where management sees each wypłata's status straight away, built like the
  existing list pages.

Rulings (user, 2026-10-11, answering `research.md` Open Questions):

1. A wypłata waiting for confirmation counts in every figure — the status is a label, it gates
   nothing (kasa balance, „Pozostało do wypłaty”, marża, sheet all unchanged).
2. Every new wypłata asks for confirmation, whoever the worker — also one without a login; it simply
   stays waiting.
3. A rejected wypłata is a management notification, like the „Zgłoszenia prac” queue: a count on
   the nav item and a „Zweryfikuj” entry that opens it. It never disappears on its own — only when
   management cancels the wypłata, or the worker changes his answer. The notifications sit on the
   home page („/”, the transactions dashboard), pinned like `PendingExpenseDrafts`
   (`components/dashboard/manager-dashboard.tsx:40-57`).
4. The worker can change his answer only to „accepted” (rejected → accepted); never back.
5. A cancelled wypłata shows to the worker as cancelled. Derived from the existing `cancelled` flag
   at display time, not a fourth stored status — one concept, one name.

6. Old wypłaty have no status and show „—” (confirmed).
7. Nothing changes in the Google Sheets — the „transfery” tab keeps its fixed 8 columns
   (`sheet-configs.ts:65`); a new header would make `resolveHeaders` refuse every live sheet.
8. The status is a column in the app's transactions table (`components/tables/transfers.tsx`), so
   it shows everywhere that table renders — the home page included. Users hide it through the
   table's existing column toggle. It is filled only on wypłata rows.

Ships first, without push. `pwa-push-notifications` (EX-1040) builds on it: the push and the app
icon badge announce wypłaty this change leaves pending.
