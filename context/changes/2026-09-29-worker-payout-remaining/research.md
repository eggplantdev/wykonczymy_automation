---
date: 2026-09-29T15:04:17+0200
researcher: Claude
git_commit: 66bbd9b2509462bea07a43bea874e762e29215de
branch: staging
repository: wykonczymy
topic: '„Pozostało do wypłaty" per worker on the employee list, and a „Rozlicz wypłaty" dialog that books one PAYOUT per investment × worker pair'
tags:
  [
    research,
    codebase,
    kosztorys,
    subcontractor-due,
    payouts,
    employees,
    transfers,
    bulk-action,
    golden-master,
  ]
status: complete
last_updated: 2026-09-29
last_updated_by: Claude
---

# Research: per-worker „Pozostało do wypłaty" + „Rozlicz wypłaty" dialog

**Date**: 2026-09-29T15:04:17+0200
**Researcher**: Claude
**Git Commit**: 66bbd9b2509462bea07a43bea874e762e29215de
**Branch**: staging
**Repository**: wykonczymy

Permalink base (commit is on `origin/staging`):
`https://github.com/eggplantdev/wykonczymy_automation/blob/66bbd9b2509462bea07a43bea874e762e29215de/<path>#L<line>`

## Research Question

What does it take to (1) show a per-worker „Pozostało do wypłaty" on `/pracownicy`, computed at the
investment × worker pair grain, (2) remove that list's all-time „Wypłaty" column, and (3) open a
„Rozlicz wypłaty" dialog from the employee list (one worker, N investments) and from the investment
list (one investment, N workers) that prefills one PAYOUT per pair and books them in one go? The
shaping decisions are recorded in `change.md`; this document checks them against the code.

## Summary

- **The figure doesn't exist server-side at pair grain.** Per-worker settlement is computed today
  only client-side, from one investment's tree (`subcontractorDueByPlane.byWorker` →
  `computeSubcontractorSummary`, and `computeWorkerSummary` for the worker view). The listing's
  `subcontractorRemaining` is computed in SQL, but per investment only (`GROUP BY investment_id`).
  The path is the one the part-1 research and the stale 2026-09-03 change both named: **add
  `worker_id` to the `GROUP BY` of the existing `lines` CTE** in
  `src/lib/db/kosztorys-subcontractor-due.ts`, and join PAYOUTs per (investment, worker). That's a
  new query, not a new formula. The TS formula and its SQL copy are pinned by a DB parity spec, and
  the per-pair version needs the same pin.
- **The listing total and Σ pairs will not reconcile as-is.** `subcontractorRemaining` subtracts
  **every** PAYOUT on the investment, including PAYOUTs with no worker (9 of them on 6 investments
  locally). In the investment-page math those sit in the `null` bucket next to unassigned etapy.
  For the dialog's greyed „Nieprzypisane etapy" row to make the rows sum to the column, that row
  must be `unassigned due − no-worker payouts`, not just unassigned due.
- **Removing „Wypłaty" is clean.** It was a naive all-time Σ PAYOUT from day one (`70726f49`,
  2026-04-11) and a leftover of the deleted „Saldo" column, hence `UserRowT.balance`. It was never
  a settlement figure. Its footprint includes the golden master's `"workers"` snapshot and input
  hash.
- **The wydatek form can't host this, as decided.** `createBulkTransferAction` has the right
  _mechanics_ (one `withPayloadTransaction`, sequential awaited creates, sheet sync once after
  commit) but shares one header across lines. The new action copies those mechanics with a per-row
  investment + worker.
- **PAYOUT never stores a payment method** (`carriesPaymentMethod` is false; the validate hook nulls
  it). The dialog therefore has no „metoda płatności" field. That corrects `change.md`.
- **An earlier prefill attempt was built and removed.** `d9b3a06a` (2026-07-28) put the per-worker
  roster on the wypłata form. `36a53a48` removed it a day later: "repeating it on the wypłata form
  put a second, staler copy of the same figures next to the amount being typed." The dialog must
  answer that objection: fetch fresh on open, and don't cache the figures in the form.
- **„zaliczka" is taken.** In this codebase it means the investor's wpłata (EX-536, glossary). The
  proposed wording „to będzie zaliczka" is ambiguous and needs a different word.
- **Role visibility is inconsistent today.** The listing column is shown to MANAGER on purpose (owner,
  2026-09-29). The investment page's per-worker panel is gated by `canSeeMargin`, and `/pracownicy` is
  open to MANAGER. The new column and dialog need a deliberate gate.

## Detailed Findings

### 1. Existing settlement math (what to reuse)

- **TS formula, one investment:** `subcontractorDueByPlane` returns
  `{ due, byWorker, byStage, hasUnconfirmedPlane }`. Each etap is priced at its own rozliczenie
  (plane), with stawka precedence: mnożnik, then kwota, then client price × investment coefficient.
  Unassigned etapy land in `byWorker.get(null)`.
- **Per-worker summary:** `computeSubcontractorSummary` + `settlementState` in
  `src/lib/kosztorys/subcontractor-summary.ts` (states: `overpaid` / `no_stages` /
  `no_executed_work` / `unattributed`). The `null` row = unassigned etapy **plus** PAYOUTs with no
  worker.
- **Worker view:** `computeWorkerSummary` in `src/lib/kosztorys/worker-view/summary.ts` =
  `byWorker.get(workerId)` − his PAYOUTs on this investment → `owed` / `isOverpaid`. It is rendered
  as „Pozostało do wypłaty" / „Nadpłata" by `summary/blocks/worker-summary.tsx`. It carries only
  `{date, amount}` per payout, deliberately without the opis (design #10).
- **SQL copy, per investment:** `src/lib/db/kosztorys-subcontractor-due.ts`. CTE `lines` = stages ⋈
  stage_progress ⋈ items (scoped to the same investment) ⋈ investments, a per-plane price `CASE`,
  `sum(qty_done*price) FILTER (WHERE plane IS NOT NULL)` and
  `bool_or(plane IS NULL AND qty_done <> 0)`, `GROUP BY investment_id` (`:73`). **It has no szablon or
  trashed-investment filter**; the new per-pair query must add one.
- **Listing column:** `src/lib/queries/shape-investments.ts`: `subcontractorRemaining` is
  `undefined` when there is no client totals row or `hasUnconfirmedPlane`, else
  `roundToCents(settlement.due − financials.totalPayouts)`. `totalPayouts` = all PAYOUTs on the
  investment, including those with no worker.
- **Cache:** `fetchKosztorysSubcontractorDue` in `src/lib/queries/balances.ts` (key
  `'kosztorys-subcontractor-due-v1'`, tags `KOSZTORYS_CLIENT_TOTALS_TAGS`). The pair query needs its own
  key and tags `KOSZTORYS_CLIENT_TOTALS_TAGS` + `transfers` (it reads PAYOUTs, which the per-investment
  due does not).
- **Per-investment guard:** `src/lib/kosztorys/payouts-by-worker.ts:20-22` forbids a second
  `GROUP BY worker_id` query. That comment is scoped to the single-investment block, where the tree is
  already loaded; a cross-investment read has no tree to fold. The plan should update the comment so
  it doesn't read as forbidding the new query.

### 2. Pair semantics against the shaping decisions (local DB, prod dump)

- PAYOUTs with no investment: 26 (salary, premia, loan, gift, fuel). They are out of the figure,
  matching EX-554 #5 („invisible on purpose").
- PAYOUTs on an investment with no kosztorys: 171 pairs, 2.77 M zł. The pair is absent, mirroring
  „brak danych".
- A pair with a kosztorys, PAYOUTs and no etap for the worker: 21 pairs. Shown as Nadpłata with an
  „assign his etap" hint.
- Unassigned etapy: 35 of 46. They don't reach the employee list and appear as the greyed dialog row.
- **Per-worker withhold never exercised locally:** both plane-null etapy with executed qty are
  unassigned. The branch needs a constructed fixture.
- Multi-investment worker: worker 59 has etapy on 2 investments, the only local case for the
  employee-list dialog. The preview DB had **zero** investments with 2+ workers on etapy
  (`manual-checks.md:1471-1474`), so staging can't demo the investment-list dialog without seeding.
- **Rounding trap (`1601b075`):** summing rows already rounded to the grosz drifted by 1 gr. Sum pairs
  at full precision and round once per displayed figure. The employee total is Σ unrounded positive
  pairs.

### 3. Employee list today

- `src/app/(frontend)/pracownicy/page.tsx:15,28`: `fetchWorkerBalances()` feeds
  `UserRowT.balance`.
- `src/components/tables/users.tsx:46-51`: the „Wypłaty" column.
- `src/lib/queries/balances.ts`: `fetchWorkerBalances` (key `'worker-balances'`, tag `transfers`).
- `src/lib/db/sum-transfers.ts:110-130`: `sumAllWorkerBalances`, plus its unit spec
  `src/__tests__/sum-transfers.test.ts:74-100`.
- **Keep** `/pracownicy/[id]` „Wypłaty" (`[id]/page.tsx:56,62`). It comes from
  `fetchFilteredByType(statsWhere)` and follows the page's filters, so it's a different figure.
- Gate: `/pracownicy` = `ADMIN_OR_OWNER_MANAGER_ROLES` (reopened to MANAGER in `2861fcb2`).
- History: `70726f49` added it, replacing the „Saldo" deleted in `a955b204`. It was never meant to
  settle anything.

### 4. Investment list today

- `src/components/tables/investments.tsx:258-266`: the `subcontractorRemaining` column,
  `withheldFigureCell`, ungated. Comment: "the owner wants every management role to see where a crew
  is still owed money." Also `V2_COLUMN_IDS`, `NoKosztorysData`, `UnsettledStages`, `HintedValue`,
  `LabelHintIcon`, all reusable for the markers.
- „Wypłaty" on the listing is ADMIN/OWNER only (`:248`).
- Rules in `context/foundation/investment-financials-and-discount.md:168-187`.
- Labels: `src/lib/kosztorys/labels.ts:26-30` `SUBCONTRACTOR_FIGURE_LABELS` = „Suma wykonanej pracy" /
  „Zaliczki (wypłaty)" / „Pozostało do wypłaty". The sheet uses these words. The dialog's shorter
  „Wykonane / Wypłacone / Pozostało" match the worker view instead. Pick one set on purpose.

### 5. Payout write path

- `src/lib/constants/transfers.ts:217-227`: PAYOUT spec. `needsWorker`; investment optional (a
  deliberate restore in `0569161c`); source kasa required; `carriesPaymentMethod` false (`:474-475`).
  `src/hooks/transfers/validate.ts:190-194` nulls paymentMethod.
- The worker can't be changed after creation (`src/collections/transfers.ts:209`).
- `src/lib/actions/transfers.ts`:
  - `createTransferAction` (`:37-79`): single create.
  - `createBulkTransferAction` (`:81-159`): one `withPayloadTransaction`, sequential awaited creates
    passing `req`, `skipSheetSync` per create, `after(() => syncBulkExpensesToSheet(createdIds))`,
    `protectedAction(..., ['transfers'])`. **These mechanics are the template.**
- **EX-855 is still unfixed:** overlapping Payload transactions on Neon can lose rows. Creates must be
  sequential inside one transaction, never `Promise.all`.
- The kosztorys lock must be checked per investment in the batch, since rows span investments.
- The overpay note (if any) is computed on the server from fresh figures, not from what the client
  sent.
- Revalidation: `['transfers']` expires `fetchInvestmentFinancials` and the new pair query. The
  kosztorys due is unaffected by a PAYOUT.
- The in-flight `context/changes/2026-09-29-transfer-actions-db-spec/plan.md` (EX-911) builds DB specs
  for these actions. Coordinate so the new action's spec follows its harness rather than duplicating
  it.

### 6. Dialog placement and wiring

- Files: `src/components/dialogs/settle-payouts-dialog.tsx`, form under
  `src/components/forms/settle-payouts-form/`, rows fetched on open by a `'use server'` read in
  `src/lib/queries/` (reads a client component invokes go in queries, never actions).
- Trigger must be a `<Button>`: `data-table-row.tsx:28-44` ignores clicks inside `a, button`, so a
  button cell won't also navigate the row.
- `src/components/ui/form-dialog.tsx` is keyed by `formId`.
- The wydatek form (`expense-form.tsx`, `bulk-expense-schema.ts`) shares date / type / paymentMethod /
  registers / investment / worker / settled across `lineItems`. Confirmed unfit.
- „Podsumowanie pracowników" renders only in the kosztorys editor, so there's no third entry point to
  keep in sync.

### 7. Tests and fixtures

- Parity pattern: `src/__tests__/lib/db/kosztorys-subcontractor-due.test.ts` +
  `helpers/kosztorys-db-tree.ts` (worker per stage already supported). Extend for pair grain: SQL pair
  = TS `byWorker` pair − payouts.
- DB action pattern: `src/__tests__/lib/actions/payout-without-stages.test.ts`.
- Golden master: `src/__tests__/financial-golden-master-db.test.ts` +
  `fixtures/financial-golden-master.json` (the `"workers"` input hash ~`:195`, snapshot ~`:3510`).
  Removing the „Wypłaty" figure removes that axis. Regenerate on a **fresh** `db:import:test`, because
  an input-hash change silently drops investments from the comparison. `qty_done` is hashed as one sum
  per investment.
- `investment-render-parity-db.test.ts:234-246` pins the listing column. A cross-check "Σ pairs +
  unassigned row = listing column" belongs next to it.
- Test plan: no risk names payouts, workers or bulk creation. The closest are #1 (two surfaces
  disagree), #2 (a mutation breaks silently), #3 (ledger drift) and #8 (fixture missing a plane).
  Extend with `/10x-test-plan` before writing tests.

## Code References

- `src/lib/db/kosztorys-subcontractor-due.ts:73`: `GROUP BY investment_id`, the seam for `worker_id`.
- `src/lib/queries/shape-investments.ts`: `subcontractorRemaining` (all payouts subtracted).
- `src/lib/queries/balances.ts`: `fetchWorkerBalances`, `fetchKosztorysSubcontractorDue`,
  `fetchInvestmentFinancials`.
- `src/lib/kosztorys/subcontractor-summary.ts`: `computeSubcontractorSummary`, `settlementState`.
- `src/lib/kosztorys/worker-view/summary.ts`: `computeWorkerSummary`.
- `src/lib/kosztorys/payouts-by-worker.ts:20-22`: the "no second GROUP BY worker_id" comment.
- `src/lib/kosztorys/labels.ts:26-30`: `SUBCONTRACTOR_FIGURE_LABELS`.
- `src/lib/db/sum-transfers.ts:110-130`: `sumAllWorkerBalances` (removal).
- `src/components/tables/users.tsx:46-51`: „Wypłaty" column (removal).
- `src/app/(frontend)/pracownicy/page.tsx:15,28`: `balance` wiring (removal).
- `src/components/tables/investments.tsx:248,258-266`: listing „Wypłaty" gate, the
  `subcontractorRemaining` column.
- `src/components/investments/investment-summary-panel.tsx:62`: `canSeeMargin` gate on per-worker panel.
- `src/lib/actions/transfers.ts:81-159`: `createBulkTransferAction`, the mechanics template.
- `src/lib/constants/transfers.ts:217-227,474-475`: PAYOUT spec, `carriesPaymentMethod`.
- `src/hooks/transfers/validate.ts:190-194`: paymentMethod nulled for PAYOUT.
- `src/collections/transfers.ts:209`: worker immutable after create.
- `src/components/tables/data-table/data-table-row.tsx:28-44`: row click ignores `a, button`.

## Architecture Insights

- **One formula, two executors, pinned by parity.** The TS fold serves the one-investment tree (editor,
  worker view); the SQL fold serves listings across all investments without loading every tree. Pair
  grain is a third _projection_ of the same SQL, not a third formula.
- **Absence is an answer.** No kosztorys → pair absent (as the listing's „brak danych"); no rozliczenie
  → withheld, never a guessed number. Same stance as the robocizna „no fallback" rule in AGENTS.md.
- **Bulk writes are sequential in one transaction** (EX-855), with the side effect (sheet sync) deferred
  to `after()` so a rollback never leaves a synced ghost.
- **A read a client needs on demand is a `'use server'` query**, keeping `lib/actions` mutation-only.

## Historical Context (from prior changes)

- `732f7567^:context/archive/2026-07-21-podsumowanie-podwykonawcow/change.md` (EX-554): the
  per-investment figure knowingly didn't say who is owed how much; per-crew „Pozostało" was named "a
  separate, bigger slice for the future". Payouts with no investment are out on purpose (#5). There is
  one „Kwota", no VAT split, because crews are paid without VAT (#4, EX-558).
- `context/archive/2026-07-27-kosztorys-stage-worker-assignment/change.md` (EX-613): one etap, one
  worker, nullable; only executed work counts. Unassigned etapy get their own row and are never spread.
  Negative remaining is always red with wording saying which case it is. An etap without rozliczenie
  earns nobody anything, and the picker is disabled until it has one. Owner: „ten wykrzyknik ma
  krzyczeć, to są pieniądze".
- `d9b3a06a` → `36a53a48` (2026-07-28/29): per-worker roster on the wypłata form, built and removed as
  a staler second copy of the figures.
- `732f7567^:context/archive/2026-09-28-kosztorys-worker-view/design.md` (EX-875): Nadpłata, never a
  negative; payouts listed without opis; other-investment payouts excluded.
- `aceb0994:context/changes/…/change.md`: listing column called "Part 1 of a two-part feature". Part-1
  research (`0ff18315`) points at adding `worker_id` to the `GROUP BY`.
- `0569161c` (2026-04-11): PAYOUT investment made optional again on purpose.
- `context/domain/02-glossary.md:161-165`: „zaliczka" = investor wpłata (EX-536).
- `context/foundation/lessons.md:236`: invalidate the golden master per entity.

## Related Research

- `context/changes/2026-09-03-worker-payouts-on-employee-card/change.md`: status `new`, nothing built,
  the same per-worker figure on the employee card, the same `GROUP BY worker_id` direction.
  **Superseded by this change.** Archive it (or fold its notes in) when this plan is approved.
- `context/changes/2026-09-29-transfer-actions-db-spec/plan.md` (EX-911): DB specs for transfer
  actions; shares a harness with the new action's spec.

## Open Questions

1. **Payouts with no worker on an investment:** does the dialog's greyed row show
   `unassigned due − those payouts` (so rows sum to the listing column), or does the plan change the
   listing to subtract only worker-attributed payouts?
2. **Who sees it:** the employee-list column and dialog for MANAGER too (matching the listing column),
   or ADMIN/OWNER only (matching the investment page's per-worker panel)?
3. **Wording for paying ahead:** „zaliczka" is taken by the investor's wpłata. Pick another word
   („nadpłata", „wypłata z góry"), and decide whether it also goes into the PAYOUT's opis.
4. **Labels:** the sheet's „Suma wykonanej pracy / Zaliczki (wypłaty) / Pozostało do wypłaty" or the
   worker view's „Wykonane / Wypłacone / Pozostało" for the dialog columns?
5. **Staleness answer to `36a53a48`:** fetch rows fresh on every open and re-validate amounts
   server-side at submit. Does the server refuse, or only warn, when the figures moved between open and
   submit?
