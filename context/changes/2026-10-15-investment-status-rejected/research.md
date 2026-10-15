---
date: 2026-10-15T15:46:47+02:00
researcher: Claude (Opus 5.5)
git_commit: 13671019439c3bf115fb04d54522fb0c1dfe4ff5
branch: staging
repository: wykonczymy
topic: "EX-1066 — status „Odrzucona” + przelewy wyłącznie na aktywnej inwestycji"
tags: [research, investments, investment-status, investment-lock, transfers, kosztorys, migrations]
status: complete
last_updated: 2026-10-15
last_updated_by: Claude (Opus 5.5)
---

# Research: status „Odrzucona” + przelewy wyłącznie na aktywnej inwestycji

## Research Question

Owner decisions (2026-10-15, EX-1066):

1. New investment status `rejected` („Odrzucona”) — the client declined at the Wycena / Planowana stage.
   Hidden by default in the investments list filter. Leaving it is free (the owner/admin-only exit guard
   stays on `completed` only).
2. Money may be booked **only onto `active`**. `quote`, `planowana` and `rejected` behave toward
   transfers like `completed`: hidden from pickers, refused by the server.

What has to change, where, and what does the current lock couple that must be split?

## Summary

- **One predicate drives two planes today.** `isLockedStatus` / `LOCKED_INVESTMENT_STATUS = 'completed'`
  (`src/lib/constants/investment-lock.ts:21-23`) and `lockMessageOf` (`src/lib/db/investment-gate.ts:32`)
  gate both the **transactions plane** (bookings) and the **kosztorys plane** (read-only editor,
  `investmentAction`, `/admin` access). Widening it to `quote`/`planowana` would freeze the kosztorys a
  Wycena is built in. The change must **split the lock into two predicates**: *bookable* = `active` and
  not trashed; *read-only* = `completed` or trashed (unchanged).
- **The server never refused `quote`/`planowana`.** `hooks/transfers/validate.ts:78-95` refuses only
  `completed` and trashed. Client-side the pickers hide non-active rows only by default
  (`EntityComboboxField` internal `activeOnly` state, `entity-combobox-field.tsx:71`, „Wszystkie”
  checkbox re-shows them), and the URL prefill from `/inwestycje/[id]` keeps a quote preselected
  (`use-investment-from-url.ts:22-26` + `is-active-ref.ts:17`). The lesson claim „nowej inwestycji nie
  ma w pickerach wpłaty/wydatku” (`lessons.md:1745`) holds as a default only, not as a guarantee.
- **A szablon has no server-side transfer refusal either** — `bookable = active` closes that for free.
- **Adding the enum value is cheap and well-trodden** — precedent `investment-wycena-status`
  (2026-09-29); the tuple in `investment-status.ts` derives the schema, options, picker and filter.
  Two `Record` maps are type-forced; `PICKABLE_INVESTMENT_STATUSES` is not.
- **Production holds three transfers on Wycena investments** (Agatha: wpłata 7000 + wypłata 5000 to the
  designer, booked by the OWNER on 14.10, investment has no kosztorys; Żubrowa: wydatek 103,94 booked by
  a MANAGER via the Wydatek dialog + AI receipt read). Because the transfer hook gates both **onto** and
  **off** an investment, a naive split freezes those rows until the investment is set to Aktywna.

## Detailed Findings

### 1. Booking paths (transactions plane)

| # | Entry point | Types | Client filter today | Server gate today |
|---|---|---|---|---|
| 1 | Wpłata: `deposit-form.tsx:207-211` → `createTransferAction` (`lib/actions/transfers.ts:42`) | INVESTOR_DEPOSIT (+ COMPANY_FUNDING / OTHER_DEPOSIT, investment cleared) | `isBookableInvestment` + default-active checkbox; URL / draft prefill kept | `transfers.ts:64-68` + `validate.ts:82-95` |
| 2 | Wydatek: `expense-form.tsx:413,433-437` → `createBulkTransferAction` (`transfers.ts:116`) | OTHER, CORRECTION, LABOR_COST, BONUS, RABAT, LOSS, INVESTMENT_EXPENSE(_NET), PAYOUT | same as #1 | `transfers.ts:158-162` + hook |
| 3 | Accepting a worker expense zgłoszenie: `use-expense-draft-acceptance.tsx:67-93` → `ExpenseForm` (`draft-prefill.ts:86-99`) | INVESTMENT_EXPENSE / OTHER | investment taken from the zgłoszenie, kept even if no longer active | same as #2 |
| 4 | Worker's phone, zgłoszenie: `sendExpenseDraftAction` (`worker-expense-drafts.ts:75`) | none — creates a draft | `listWorkerStageInvestments` — already `status='active'` (`stage-memberships.ts:24-28`) | `findDraftTargetError` (`worker-expense-drafts.ts:52-72`) — already active-only |
| 5 | Edit: `edit-transfer-form.tsx:170-174` → `updateTransferAction` (`transfers.ts:323`) | any with investment | **unfiltered list** (gap) | `fetchAndAuthorize` `transfers.ts:258` + hook (old and new investment) |
| 6 | Cancel: `cancel-transfer-button.tsx:38` → `cancelTransferAction` (`transfers.ts:275`) | `cancelled:true` + CANCELLATION | n/a | `fetchAndAuthorize` + hook on the original |
| 7 | Transfers table edit/cancel buttons: `tables/transfers.tsx:283-297` | — | `!isBookableInvestment` hides, `disabledReason = INVESTMENT_LOCKED_MESSAGE` | none (UI hint) |
| 8 | Invoice attach/remove: `transfers.ts:415-456` | invoice only | n/a | deliberately open (`isInvoiceOnlyPatch`, `validate.ts:84`, EX-748 #3) |
| 9 | „Rozlicz wypłaty”: `settlePayoutsAction` (`settle-payouts.ts:38`) | PAYOUT | pairs `classifyPair` 'locked' only for completed (`lib/kosztorys/worker-payout-pairs.ts:58`) | `lockInvestmentGates` `settle-payouts.ts:64-71` + hook |
| 10 | „Wyrównaj premią”: `bookOverpaymentBonusAction` (`book-overpayment-bonus.ts:31`) | BONUS | same pairs | `lockInvestmentGates` `:49-53` + hook |
| 11 | `/admin` + REST `/api/transactions` | any | no `filterOptions` | ADMIN/OWNER access + hook; delete `guard-delete.ts:16` |
| 12 | Worker payout decision: `lib/db/payout-confirmation.ts:46,59` | raw `UPDATE` of status columns | n/a | bypasses hook on purpose — not a booking |
| 13 | Worker report acceptance: `accept-worker-report.ts` | **no transactions** | n/a | `lockInvestmentGates:95` — kosztorys plane |
| 14 | Seed scripts (`seed-worker-payouts.ts:105`, `seed-deposit-planes.ts:148`, `seed-materials-net.ts:130`) | raw `INSERT` | n/a | bypass hook (test data only) |

Read-only toward transactions: duplicate finder, sheets sync, `/api/extract-receipt`, report scan.
`internal-transfer-form` books REGISTER_TRANSFER (no investment) — out of scope.

### 2. Lock consumers, by axis

**Booking axis** (switch to *bookable*):
- `investment-lock.ts:50` `isBookableInvestment` → feeds `deposit-form.tsx:211`, `expense-form.tsx:437`,
  `use-investment-from-url.ts:23`, `tables/transfers.tsx:284`.
- `hooks/transfers/validate.ts:78-95` (onto + off), `hooks/transfers/guard-delete.ts:16`.
- `lib/actions/transfers.ts:64`, `:158`, `:258` (`fetchAndAuthorize` → cancel `:285`, update `:337`).
- `lib/actions/settle-payouts.ts:64-71`, `lib/actions/book-overpayment-bonus.ts:49-52`.
- `lib/db/payout-confirmation.ts:143` → `verify-rejected-payout-dialog.tsx:39-40`.
- `lib/kosztorys/worker-payout-pairs.ts:58` ('locked') + reason `:28-32` + badge `settle-payouts-table.tsx:66`.
- Gap: `edit-transfer-form.tsx:174` picker unfiltered.

**Read-only axis** (unchanged — `completed` ∪ trashed):
- `lib/actions/investment-action.ts:61/66/80` — every kosztorys mutation (items, sections, stages,
  settings, import, sheets link, snapshots, presets, catalogue, translations, report scan, acceptance,
  `applyMaterialSync`).
- `lib/actions/accept-worker-report.ts:95-97` (via `lockInvestmentGates` — **shared with the booking
  axis; needs a predicate parameter or two functions**).
- `lib/actions/sheets.ts:158-168` `lockedSheetError`.
- `access/investment-lock.ts:24-69` (`/admin` on sheets, kosztorys-items/-stages/-sections, stage-progress).
- Editor: `kosztorys_v2/page.tsx:125` → `use-kosztorys-editor.ts:195`, banner `kosztorys-locked-banner.tsx`.
- `lib/db/worker-reports.ts:113` `DECIDABLE_INVESTMENT`.

**Completed semantics, not a lock** (stay completed-only): `guard-status-unlock.ts:22-24`,
`stamp-completed-at.ts:15-18`, `inwestycje/[id]/page.tsx:72` and `tables/investments.tsx:337`
(`RequestReviewButton`), `investment-form.tsx:63-64,97-104`, `review-request.ts:26-36`,
`snapshots.ts:83,231`, `investment-data-table.tsx:85` (dim).

**Worker share link**: `worker-report-share.ts:62` → `share-refusal.ts:6` → `token-action.ts:47-48`,
scan `worker-report-scan.ts:40` — refuses only on the read-only axis, so a link on a Wycena accepts
reports (2 such links exist locally). The worker's own page already lists only `active`
(`stage-memberships.ts:22-29`, owner 2026-10-05).

### 3. User-facing copy that becomes wrong

- `INVESTMENT_LOCKED_MESSAGE` (`investment-lock.ts:6-7`) „Inwestycja jest zakończona i tylko do odczytu…”
  — shared by both planes; the booking axis needs its own sentence (true for Wycena / Planowana /
  Odrzucona / Zakończona alike).
- `worker-payout-pairs.ts:28-32` „Inwestycja zakończona — przywróć na Aktywna, żeby wypłacić”.
- `tables/transfers.tsx` `disabledReason`.
- Worker link `pl.ts:33` / `uk.ts:24` / `ru.ts:24` „…zamknięta — zgłoszenia prac nie są już przyjmowane”
  (only if the link gets the booking-axis rule — „już” is wrong for a Wycena).

### 4. Adding the status value

| file:line | Action |
|---|---|
| `src/lib/constants/investment-status.ts:4` | `'rejected'` after `'completed'` |
| `src/lib/constants/investment-status.ts:8-14` | label `{ pl: 'Odrzucona', en: 'Rejected' }` (type-forced) |
| `src/lib/constants/investment-status.ts:19-24` | add to `PICKABLE_INVESTMENT_STATUSES` (**not** type-forced) |
| `src/components/investments/investment-status-badge.tsx:5-11` | `STATUS_CLASSNAMES.rejected` (type-forced; used: sky, amber, emerald, muted, violet) |
| `src/hooks/use-status-filter.ts:10` | `DEFAULT_STATUSES` unchanged → hidden by default |
| `src/hooks/use-status-filter.ts:14` | no `INHERITED_FLAG` entry: a missing key reads as unselected (`:39,43-47`) |
| derived, no edit | `collections/investments.ts:21`, `investment-schema.ts:15`, `investment-form.tsx:169`, `status-filter.tsx:29,46`, `investment-info-fields.tsx:35`, `investments-status.db.test.ts:39` |

No i18n: investment status labels are rendered from `INVESTMENT_STATUS_LABELS[…].pl` only.
Golden master / parity: unaffected (no `rejected` rows in the dump).

### 5. Migration

- Enum `"enum_investments_status"` (created `20260211_212425.ts:5`; values added in `20260718_0`,
  `20260914_0`, `20260929_3`).
- Shape: `ALTER TYPE "enum_investments_status" ADD VALUE IF NOT EXISTS 'rejected';` — no `AFTER`, value
  not used in the same file (no `UPDATE`/`DEFAULT`), `down()` a documented no-op (Postgres has no
  `DROP VALUE`).
- File: `src/migrations/20261015_1_add_rejected_investment_status.ts` (`20261015_0_…` exists). Register
  in `src/migrations/index.ts` (import after `:152`, array entry after `:910-914`). Re-run
  `git status src/migrations` before creating it — parallel sessions.
- Additive → prod migrate before push (human, `pnpm db:migrate:prod`).
- Rollback is not data-free: old code crashes on an unknown label (`investment-info-fields.tsx:35`) —
  `UPDATE investments SET status = … WHERE status = 'rejected'` before reverting code.

### 6. Production data (read-only, 2026-10-15)

| Investment | Status | Transfer | Booked by / path |
|---|---|---|---|
| 208 Marszałkowska 55/73 lok 75 – Agatha | quote | INVESTOR_DEPOSIT 7000 (14.10 06:55) | OWNER, Wpłata dialog (#1) |
| 208 (same) | quote | PAYOUT 5000 to „Tomasz Litwin - projektant” (14.10 07:27, `pending`) | Wydatek dialog, type Wypłata (#2); investment has 0 pozycji, 0 etapów |
| 177 Żubrowa | quote | INVESTMENT_EXPENSE 103,94 (05.10) | MANAGER, Wydatek dialog + AI receipt (#2) |

Both investments were `quote` at booking time (`updated_at = created_at`, column default `'quote'`).
No transfers on `planowana`.

## Code References

- `src/lib/constants/investment-lock.ts:6-7,21-23,28-35,50` — shared lock, message, `isBookableInvestment`
- `src/lib/db/investment-gate.ts:32,38-117` — `lockMessageOf`, single-row gates, `lockInvestmentGates:73`
- `src/hooks/transfers/validate.ts:78-95` — the complete transactions-plane gate (onto + off)
- `src/hooks/transfers/guard-delete.ts:16` — delete half
- `src/lib/actions/transfers.ts:64,158,258` — action-level early refusals
- `src/lib/actions/settle-payouts.ts:64-71`, `src/lib/actions/book-overpayment-bonus.ts:49-53`
- `src/lib/kosztorys/worker-payout-pairs.ts:28-32,58,104`
- `src/components/forms/edit-transfer-form/edit-transfer-form.tsx:170-174` — unfiltered picker
- `src/components/forms/hooks/use-investment-from-url.ts:22-26` — URL prefill
- `src/access/investment-lock.ts:24-69` — `/admin` kosztorys-plane access
- `src/lib/actions/investment-action.ts:61-80` — kosztorys-plane action wrapper
- `src/lib/actions/accept-worker-report.ts:95-97` — kosztorys-plane use of `lockInvestmentGates`
- `src/lib/db/worker-report-share.ts:62`, `src/lib/actions/token-action.ts:47-48` — worker link refusal
- `src/lib/db/snapshots.ts:83,231` — daily snapshot eligibility / expiry
- `src/hooks/use-status-filter.ts:10-47` — default filter + persisted map
- `src/lib/constants/investment-status.ts:4-24` — the tuple and labels

## Architecture Insights

- The lock module already anticipates this: „a second locking status would otherwise mean finding six
  literals” (`investment-lock.ts` docblock). The split is the honest form: two named predicates over the
  status union, each spelled once, each with its own message — not a second literal in six places.
- The transactions plane has **one complete gate** (the collection hook) — switching it covers `/admin`,
  REST and Local API scripts at once. The action-level checks exist only to return a readable sentence.
- `lockInvestmentGates` is the only primitive used by both planes; it needs an explicit axis.
- `isBookableInvestment` takes `string`, not the union (lesson „Status inwestycji to etykieta, nie
  bramka”, `lessons.md:1740-1746`, rule 2): the new rule must be explicit in `investment-lock.ts` with a
  spec row per status.

## Historical Context (from prior changes)

- `context/archive/2026-08-28-investment-lock-on-completed/change.md` (EX-748, owner rulings 2026-09-03):
  total lock for every role on `completed`; only OWNER/ADMIN exit it (a MANAGER could otherwise flip,
  book, flip back); invoices stay open (#3); `applyMaterialSync` blocked (#4); client link open (#5);
  the investment record outside the lock (#6); cancellation blocked (#7).
- EX-770 (lesson `lessons.md:1755-1760`): an `update` gate needs both arms; `not_equals` on a nullable
  relation lets NULL through, `not_in` does not.
- `context/archive/2026-09-29-investment-wycena-status/` (plan at
  `0308e634:context/changes/2026-09-29-investment-wycena-status/plan.md`): added `quote` with zero
  server/SQL changes; quote hidden under „Aktywne” and bookable once unticked — the gap this change
  closes.

## Related Research

- `context/archive/2026-09-29-investment-wycena-status/`
- `context/archive/2026-08-28-investment-lock-on-completed/`

## Open Questions (owner)

1. **Lifting a transfer off a non-active investment.** The hook gates onto *and* off. Keep that for
   Wycena / Planowana / Odrzucona (the three prod rows freeze until the investment is set to Aktywna), or
   block only *onto* and leave cancel / edit / move-off open? EX-748 #7 (cancel blocked) was a
   `completed` rationale.
2. **Agatha (208):** the owner booked a zaliczka and a designer's wypłata on a Wycena with no
   kosztorys. Is money before the start of works (zaliczka, projekt) a real case — and if so, is
   „flip to Aktywna first” the intended answer?
3. **Kosztorys on Odrzucona:** editable (a client may come back) or read-only like Zakończona?
4. **Worker report link on a non-active investment:** refuse reports (as the worker's own page already
   does)?
5. **Odrzucona in daily snapshots** (`snapshots.ts:83`): keep capturing a dead offer, or exclude?
6. **Dim Odrzucona rows** in the investments list like Zakończona (`investment-data-table.tsx:85`)?

## Follow-up 2026-10-15 — owner narrows the scope

**No lock.** The owner drops the server-side refusal: „wystarczy, że ukryjemy te inwestycje w formularzach
i tyle”. Consequences for the plan:

- The lock split (§2) is **out of scope** — `isLockedStatus`, `lockMessageOf`, `validate.ts`,
  `lockInvestmentGates`, `access/investment-lock.ts`, the kosztorys plane and every spec in §3 of the
  lock inventory stay as they are. Open questions 1, 3 and 4 fall away with it (nothing is refused, so
  nothing freezes; the kosztorys stays editable; the worker link is untouched).
- **In scope:** the investment pickers of the booking forms list only `active` investments — no
  „Wszystkie” escape, no URL prefill of a non-active one: `deposit-form.tsx:211`,
  `expense-form.tsx:437`, `use-investment-from-url.ts:23`, `edit-transfer-form.tsx:174` (keep the
  transfer's current investment selected, `activeOrSelected`).
- **Trap:** `isBookableInvestment` also drives the transfers table's edit/cancel buttons
  (`tables/transfers.tsx:283-297`) with the „zakończona” `disabledReason`. Narrowing it to `active` would
  silently lock edit/cancel for transfers on Wycena / Planowana — the lock the owner just declined. The
  picker filter needs its own predicate; the table keeps the completed-only one.
- Plus the status itself (§4–§5): tuple, label, badge colour, `PICKABLE_INVESTMENT_STATUSES`, hidden by
  default in the list filter, migration `20261015_1_add_rejected_investment_status.ts`.
- Still open, cosmetic/minor: dim Odrzucona rows like Zakończona (q6); daily snapshots on Odrzucona (q5).
