---
date: 2026-10-09T09:41:23+02:00
researcher: Claude (Opus 5.5)
git_commit: b324480f6730a2f61fa48701c225189127134bae
branch: staging
repository: wykonczymy
topic: "Worker flag „can add expenses without investment" — expense draft with no investment from /pracownicy/[id]"
tags: [research, codebase, worker-expenses, expense-drafts, users, transfers]
status: complete
last_updated: 2026-10-09
last_updated_by: Claude (Opus 5.5)
---

# Research: Worker flag — expense draft without an investment

**Date**: 2026-10-09T09:41:23+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: b324480f6
**Branch**: staging
**Repository**: wykonczymy

## Research Question

Add a per-worker field „może dodawać wydatki bez inwestycji". A worker with it set can, on his own
`/pracownicy/[id]`, send an expense draft (faktura/paragon) without picking an investment.

## Summary

- The worker expense draft (EX-971) is **investment-only by owner design** — „tylko wydatek
  inwestycyjny" (`context/archive/2026-10-05-worker-expenses/change.md`). No doc or commit ever
  discussed a draft without an investment; this change reverses that scope for flagged workers.
- The investment is hard-wired at **every layer**: the button gate, the dialog, the zod schema, the
  membership check, `NOT NULL` + `ON DELETE CASCADE` on `worker_expense_drafts.investment_id`, and
  **inner joins** in every draft read — a null-investment draft would silently vanish from every list,
  from the pending badge, and could never be restored.
- **Acceptance already supports the target shape.** Management books a draft through the normal
  expense form, whose type is editable; switching to `OTHER` („Inny wydatek") hides and nulls the
  investment. `OTHER` is the existing „company purchase" type (tools etc.): kasa required, category
  required per row, never synced to the owner's sheet, and since EX-1027 carries an optional worker as
  the **buyer**. Nothing in `createBulkTransferAction`, the transfer validate hook, sheet sync or the
  duplicate-candidates query needs to change.
- The user flag follows the `active` checkbox template end-to-end (collection → worker form → action
  → `reference-data` → page). The **server must enforce it with a fresh DB read**, not the JWT
  (90-day tokens), mirroring how `findDraftTargetError` already reads stage memberships per request.

## Detailed Findings

### 1. Worker-side UI

- Page `src/app/(frontend)/pracownicy/[id]/page.tsx` — `fetchWorkerStageInvestments(userId)` (:83)
  lists only active, non-trashed investments where the worker sits on a kosztorys etap
  (`src/lib/db/stage-memberships.ts:25-46`). Passed to `WorkerQuickActions` (:140) and
  `WorkerExpenseDraftsSection` (:159-166).
- **Button gate** `src/components/users/worker-quick-actions.tsx:28`:
  `canAddExpense = sendableRegisters.length > 0 && investmentLinks.length > 0` — a flagged worker
  with no etap gets no button today.
- **Dialog** `src/components/worker-expenses/expense-draft-dialog.tsx`: auto-picks a sole investment
  (:54-56), seeds state from `String(draft.investmentId)` (:68-70, re-seed :104), requires it in
  `canSend` (:84-85), sends `investmentId: Number(investmentId)` (:114 — empty string → `0`), plain
  `<Select>` with no „none" option (:162-176).
- **Worker history table** `worker-expense-drafts-table.tsx`: filter key `String(d.investmentId)`
  (:30), filter options from `investmentId`/`investmentName` (:87-88), delete confirm names the
  investment (:79 → `delete-expense-draft-button.tsx:15,39`).

### 2. Data model — raw SQL, no Payload collection

- `src/migrations/20261005_3_add_worker_expense_drafts.ts:11` —
  `"investment_id" integer NOT NULL REFERENCES "investments"("id") ON DELETE CASCADE`; index :27.
- Access is enforced in actions only (`sessionAction` = the worker himself, `protectedAction` =
  management) plus `WHERE worker_id = …`.
- `src/lib/db/worker-expense-drafts.ts`:
  - `ExpenseDraftRowT.investmentId: number`, `investmentName: string` (:42-43); mapper uses
    `Number(row.investment_id)` (:123-124).
  - **Inner joins** `JOIN investments i ON i.id = d.investment_id` in `DRAFT_SELECT` (:89),
    `PARAGON_SELECT` (:231), `countPendingExpenseDrafts` (:264 → unread badge,
    `src/lib/queries/unread-counts.ts:36`), filter options (:320-324).
  - `PARTIES_NOT_TRASHED` (:181-185) requires `EXISTS (… iv.id = d.investment_id AND iv.trashed_at IS NULL)`
    — false for null, so a rejected no-investment draft is hidden by `LISTED_DRAFT` (:188) and
    unrestorable (:397, :419).
  - `PENDING_DRAFT = d.status='pending' AND i.trashed_at IS NULL` (:250).
  - Sort by `i.name` (:276); insert/update write `investment_id` (:164-165, :451-470);
    `restoreSkippedReceipt` copies it (:420-425).
  - `pendingDraftsProbe('investment')` (:637-641) blocks trashing an investment with pending drafts
    (`src/lib/investments/delete-blocker.ts:14`) — unaffected by null drafts.

### 3. Server actions — `src/lib/actions/worker-expense-drafts.ts`

- `investmentId: z.number().int().positive(pl.notices.chooseInvestment)` (:31); update schema
  derives from it (:43-45).
- `findDraftTargetError` (:54-66) — `listWorkerStageInvestments` membership check →
  `'notOnInvestment'`, plus `isWorkerLiveRegister` (`src/lib/db/cash-register-gate.ts:19-30`).
  Called by send (:77) and update (:219). This is where the flag check belongs: null investment
  allowed **only** when a fresh read of the acting user's flag is true; the kasa check stays.
- Restore error texts name the investment (:130, :145) — cosmetic.

### 4. Acceptance (management)

- `src/components/worker-expenses/use-expense-draft-acceptance.tsx:63-89` prefills
  `type: 'INVESTMENT_EXPENSE'`, `paymentMethod: 'CASH'`, `sourceRegister`, `investment:
String(draft.investmentId)`. Reject confirm `${workerName} · ${investmentName}` (:239).
- `src/components/forms/expense-form/expense-form.tsx`: type `<Select>` editable during acceptance
  (:357-372, limited by `canBookTransferType`); investment combobox only when `showsInvestment(type)`
  (:383-389); switching type re-derives/clears the investment (:330-335).
- `src/lib/actions/transfers.ts:105-208` `createBulkTransferAction` books with the **form's**
  investment, not the draft's (:168); `decideExpenseDraft` links transfers without comparing
  investments (:181-190). So the booked row is already decoupled from the draft's investment.
- Type rules (`src/lib/constants/transfers.ts`): `REQUIRES_INVESTMENT_TYPES` incl.
  `INVESTMENT_EXPENSE`/`_NET` (:544-556); `INVESTMENT_TYPES` excludes `OTHER` (:531-541); `OTHER`
  spec — source register required, `financialBucket: 'none'`, not synced (:118-128); optional
  per-row worker and required `otherCategory` (:571, :575).
- Validation: `src/lib/schemas/transfer-validation.ts:54` (investment required by type), :96
  (`expenseCategory` for investment expense), :103 (category per row for `OTHER`);
  hook `src/hooks/transfers/validate.ts:148` (required), :157 (nulls investment for `OTHER`), :168
  (`otherCategory` required).
- AI read never fills a category (`apply-receipt-to-row.ts:31`, `read-expense-draft-receipts.ts:37`)
  — an `OTHER` acceptance means a manual category pick per row.

### 5. Management listing („Zgłoszenia wydatków")

- `src/components/tables/expense-drafts.tsx:82-85` „Inwestycja" column (`accessor('investmentName')`);
  transfer link already null-safe (:37-38).
- Sort key `src/lib/worker-expenses/sortable-columns.ts:3` (`investmentName` → `i.name`).
- Filter `src/lib/db/queue-filters-where.ts:16` `inList(investment_id, …)` — no „no investment"
  value; options from `zgloszenia-wydatkow/page.tsx:30`, `expense-drafts-data-table.tsx:32,83`.
- Duplicates `src/lib/db/expense-duplicate-candidates.ts:75,119` already `LEFT JOIN` with
  `investmentName: string | null` (:23) — null-safe.

### 6. The user flag — plumbing

- `src/collections/users.ts`: `active` (:97-106) = `checkbox`, `defaultValue: true`, field access
  `isAdminOrOwnerField`; collection `update: canUpdateUser` (MANAGER → EMPLOYEE rows only,
  `src/access/index.ts:48-52`).
- **Field access does not apply on the app's write path.** `createWorkerAction` /
  `updateWorkerAction` (`src/lib/actions/workers.ts:19-63`) call `payload.create/update` with no
  `user` → Local API `overrideAccess: true`. Field access on the new field would only gate REST and
  `/admin`; who-may-set-it has to be decided in the action (or accepted as „any management role",
  like `active` is de facto today through this dialog).
- Form: `src/components/forms/worker-form/worker-schema.ts:7-15` (`workerFormSchema`, domain schema
  `.extend`s it :21-31); `worker-form.tsx` `toData` maps fields one by one (:54-63), checkbox
  precedent `<field.Checkbox label="Aktywny" />` (:111); dialogs `edit-worker-dialog.tsx:28-38`,
  `add-worker-dialog.tsx:11-18` (`EMPTY_DEFAULTS`). Management dialogs are Polish-only.
- Read path: `src/lib/queries/reference-data.ts` raw SQL users select (:85-90), mapper (:146-159,
  `satisfies WorkerRefT`), cache key `['reference-data-v7']` (:186) → **bump to v8** when widening
  `WorkerRefT` (`src/types/reference-data.ts:40-44`) — lessons.md „Widening a type that flows
  through an `unstable_cache` payload needs a KEY bump".
- Session: only `name`/`role` are `saveToJWT`; `SessionUserT` = `{id,email,name,role}`
  (`src/types/auth.ts:3-8`). Don't put the flag on the JWT — a revoke would lag up to 90 days.
- Migration: precedent `src/migrations/20261001_1_users_trashed_at.ts`; boolean-with-default
  `20260930_1_add_kosztorys_stage_workers.ts:31` (`boolean NOT NULL DEFAULT false`). Today already
  has `20261009_1`/`_2`, so next is `20261009_3_…`; register in `src/migrations/index.ts`. Additive
  → migrate prod before the code ships.
- i18n: `pl`/`uk`/`ru` (`src/lib/i18n/languages.ts:5`); `uk`/`ru` typed `typeof pl`, so a new key
  must land in all three. Relevant namespaces: `workerPage`, `expenseDrafts` (`pl.ts:118`, column
  label :121), `notices` (`notOnInvestment` :48, `chooseInvestment` :50, :137).
- Display: manager-only `infoFields` row pattern on the worker page (:114-127); optional column in
  `src/components/tables/users.tsx` / `UserRowT`.

## Code References

- `src/migrations/20261005_3_add_worker_expense_drafts.ts:11` — `investment_id NOT NULL … CASCADE`
- `src/lib/db/worker-expense-drafts.ts:42-43,89,123-124,181-188,231,250,264,276,320-324,397,419` — every investment assumption in the draft DAL
- `src/lib/actions/worker-expense-drafts.ts:31,54-66,77,219` — schema + membership check (flag enforcement point)
- `src/components/users/worker-quick-actions.tsx:28` — button gate
- `src/components/worker-expenses/expense-draft-dialog.tsx:54-56,68-70,84-85,104,114,162-176` — picker
- `src/components/worker-expenses/use-expense-draft-acceptance.tsx:63-89,239` — acceptance prefill
- `src/components/forms/expense-form/expense-form.tsx:330-335,357-389` — type switch clears investment
- `src/lib/constants/transfers.ts:118-128,531-575` — `OTHER` spec, investment predicates
- `src/lib/actions/workers.ts:19-63` — worker create/update (bypasses field access)
- `src/lib/queries/reference-data.ts:85-90,146-159,186` — worker read + cache key

## Architecture Insights

- **Draft ≠ booking.** The draft carries the worker's _claim_; the booked transfer carries
  management's decision (investment can be changed at acceptance — confirmed by
  `2026-10-06-worker-expense-drafts-history`, whose „Wydatek" link reads the transaction's
  investment, not the draft's). A null-investment draft therefore needs no change on the transfer
  plane — only the draft plane and the acceptance prefill.
- **Shown vs required predicates** (`showsInvestment` / `requiresInvestment`) are the repo's
  established split; EX-1027 reused it for the worker field. The worker-side picker can follow the
  same split: shown when the worker has investments, required unless flagged.
- **`OTHER`'s `worker_id` is the buyer, not a payee** (`context/foundation/investment-financials-and-discount.md:227-233`)
  — every money reader filters `type IN ('PAYOUT','BONUS')`. Prefilling the draft's worker onto an
  `OTHER` row is safe for the money figures; it is exactly what EX-1027 built the field for.
- Lessons that apply: unstable_cache key bump; migration filename ordering; a draft names worker,
  investment and kasa with CASCADE and a pending draft blocks trashing all three (lessons.md:2548) —
  with a nullable investment the probe still works, but the CASCADE question changes nothing for
  null rows.

## Historical Context (from prior changes)

- `context/archive/2026-10-05-worker-expenses/change.md` (EX-971) — owner: „Osobny przycisk „Dodaj
  wydatek" — tylko wydatek inwestycyjny"; investment list limited to „Moje inwestycje"; kasa = his
  default. Research/plan only in git: `git show 79800e113:context/changes/2026-10-05-worker-expenses/research.md`,
  `git show f219720d5:…/plan.md` (acceptance → `INVESTMENT_EXPENSE` with draft's investment, l.28/228).
- `2026-10-08-other-expense-worker` (EX-1027; `git show 936d4292c:context/changes/2026-10-08-other-expense-worker/research.md`)
  — `OTHER` gains an optional buyer worker; owner rulings 2026-10-08 (row shows on worker's page,
  worker editable after save on `OTHER` only, „Suma" tile filter, per-row in „Kilka wydatków").
  Prefilling the worker from `draft.worker_id` was explicitly **out of scope** there (EX-1004).
- `2026-10-06-worker-expense-ai-prefill` (EX-1001) — AI reads photos in `after()`; no investment logic.
- `2026-10-07-invoice-duplicate-detection` (EX-1025) — duplicate query already null-safe on investment.
- `context/archive/2026-08-12-ex-557-legacy-deposit-types/` — precedent of the owner dropping the
  investment requirement from a type (deposits).

## Related Research

- `git show 79800e113:context/changes/2026-10-05-worker-expenses/research.md`
- `git show 936d4292c:context/changes/2026-10-08-other-expense-worker/research.md`

## Open Questions

Business decisions (owner):

1. ~~What does management book from a no-investment draft?~~ **Decided 2026-10-09: „Inny wydatek"
   (`OTHER`).** Acceptance prefills `type: 'OTHER'`, no investment, the draft's kasa, and the
   draft's worker as buyer (EX-1027 field). Category stays a manual pick per row (AI never fills it).
2. ~~Explicit choice or empty picker?~~ **Decided 2026-10-09: explicit** „Bez inwestycji" option in
   the select, offered only to a flagged worker. No implicit default — a forgotten pick must not go
   through as a company expense.
3. ~~Button for a flagged worker with zero etapy?~~ **Decided 2026-10-09: yes** — such workers
   exist. The gate (`worker-quick-actions.tsx:28`) becomes „has a sendable kasa AND (has an
   investment OR is flagged)"; with no investments the select holds only „Bez inwestycji".
4. ~~Who sets the flag?~~ **Decided 2026-10-09: any management role** — a checkbox in „Edytuj /
   Dodaj pracownika", saved by `create/updateWorkerAction` (already `protectedAction` =
   management). Field access on the collection stays open to management too, so REST/`/admin` agree.
5. ~~Revoking the flag with pending no-investment drafts?~~ **Decided 2026-10-09: the flag does not
   affect existing drafts** — they stay pending/acceptable as-is. The server check gates only a new
   send. Plan detail: an **update** of an existing no-investment draft by a now-unflagged worker —
   keep „Bez inwestycji" allowed when the draft already has it (so editing photos/note doesn't
   force an investment), but never allow switching a real investment to none.

Technical, for the plan:

6. Migration set: `users.<flag> boolean NOT NULL DEFAULT false` + `ALTER COLUMN investment_id DROP
NOT NULL` on `worker_expense_drafts` (CASCADE stays — null rows are untouched by it). One
   additive migration, prod first.
7. DAL rewrite to `LEFT JOIN` + `(i.id IS NULL OR i.trashed_at IS NULL)` /
   `(d.investment_id IS NULL OR EXISTS …)` — the trashed-party predicates are where a null silently
   hides a row; each needs a spec.
8. Management queue filter: add a „Bez inwestycji" value to `queue-filters-where.ts:16`, or leave
   the filter as-is (null rows only visible unfiltered)?
9. Existing specs build `ExpenseDraftRowT` with numeric `investmentId` — widening to `number | null`
   will ripple through `src/__tests__/lib/db/`, `…/lib/actions/`, `…/components/worker-expenses/`.
