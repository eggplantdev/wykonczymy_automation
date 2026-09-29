---
change_id: investment-lock-on-completed
title: A completed investment is locked — read-only for every role
linear: EX-748
status: archived
created: 2026-08-28
updated: 2026-09-03
archived_at: 2026-09-03T11:29:49Z
branch: staging
worktree: null
---

## Notes

Status `completed` makes the investment, its transactions and its kosztorys read-only for **every**
role, ADMIN/OWNER included — the lock is total; no role edits through it.

Switching to `completed` goes through a confirmation dialog: "the investment will be locked,
read-only" — with **no** mention that it can be unlocked.

The only way out is an explicit status change back to „Aktywna", available to OWNER/ADMIN only, also
behind a confirmation dialog. There is no separate "Unlock" action — unlocking IS the status change.
Why the door stays: an irreversible lock turns one misclick on a 400-item kosztorys into a permanent
freeze whose only repair is hand-written SQL on production Neon.

Where the gate sits per write plane (Payload vs raw SQL): `context/foundation/lessons.md` → EX-748.
The editor's lock is a separate `locked` flag (`readOnly = preview || locked`), not `preview` —
`preview` is the client's document and swaps the layout, drops columns, filters and the toolbar.

### Owner rulings (2026-09-03)

1. **Locked from day one, on all 69 completed investments.** No migration, no second marker, no
   transition period. The owner's reasoning: an investment is completed only once settled, payouts
   included — so the 84 transactions booked after completion are not a path to protect but evidence
   of premature closing. Unlock requests in the first weeks are a list of such investments, not a
   rollout cost.
2. **Unlock audit trail — WITHDRAWN, conditionally.** With the exit from `completed` limited to
   OWNER/ADMIN (see #6), the suspects are the owner and the admin — a trail would answer no question
   the owner doesn't already know. The decision returns the moment any other role gets the exit; the
   shape to copy then is `src/collections/amount-edits.ts` (append-only,
   `create/update/delete: () => false`, `read: isAdminOrOwner`).
3. **Invoices stay open on a locked investment.** The only exception to the total lock. Attaching
   and detaching a scan moves no figure, and invoices routinely arrive after the work closes —
   blocking them would force an unlock just for a PDF, after which nobody relocks. Upholds the
   2026-08-10 decision (`addTransferInvoicesAction` deliberately bypasses `fetchAndAuthorize`,
   `lib/actions/transfers.ts`).
4. **Read boundary:** `previewKosztorysImport` / `compareWithSheet` stay (they read),
   `applyMaterialSync` is blocked (writes to the owner's sheet), `savePresetAction` stays (it saves a
   global template, not the investment — a completed investment is a good template source).
5. **The client link and client-view settings stay available** — revoking a link is a security
   operation and must never be blocked.
6. **The investment record is OUTSIDE the lock — the gate has two planes, not three.** The goal is to
   stop money moving, not to freeze the contact card. The investment form's fields (`name`,
   `address`, `phone`, `email`, `contactPerson`, `notes`, `review`, `status`) move no figure, so
   `updateInvestmentAction` is untouched: no field diff, no "status only" rule, no allowed-transition
   list. Status is an ordinary form field again and OWNER/ADMIN sets it freely.
   The split follows the `investments` columns exactly: the financial fields (`wToolsCoeff`,
   `ownToolsCoeff`, `vatRate`, `settlementMode`, `materialsNetRate`, `globalDiscountType`,
   `globalDiscountValue`) are written only by the kosztorys actions of the editor's settings panel,
   so they fall under the kosztorys gate — VAT and the global discount recompute the whole kosztorys.
   **The one exception, on which everything else rests: leaving `completed` requires OWNER/ADMIN.**
   Without it the lock is fake: `updateInvestmentAction` runs on `MANAGEMENT_ROLES`, so a MANAGER
   would flip „Zakończona" → „Aktywna", book anything and flip it back. **Entering** `completed`
   stays open to the manager — closing settled work is his job.
   The rule lives in the `investments` collection's **`beforeChange` hook**
   (`guardInvestmentStatusUnlock`), not in the action: `/admin` grants the manager `update` on
   investments. The hook sees `originalDoc.status` and `data.status`, so it catches the action, the
   Local API and REST at once; the action only adds a readable Polish message.
7. **Cancelling a transaction is blocked.** A `CANCELLATION` on a locked investment requires
   unlocking — a mistake found after closing takes the same route as any other change.
8. **Deleting an investment — NO gate added (withdrawn).** An investment with any transaction is
   already undeletable (`investmentDeleteBlocker`). That leaves only a completed investment with no
   transactions at all — nothing to protect there.
9. **One confirmation dialog, role-independent.** No OWNER/ADMIN wording variant — simplicity beats a
   more precise message.
