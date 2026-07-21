# Wpłata netto/brutto (bucket model) + drop stage link + Do zapłaty netto/brutto — Implementation Plan

> Calc model + owner decisions: `context/changes/kosztorys-zaliczka-netto-brutto/design-bilans-vat-planes.md`
> (section **„CONFIRMED calc model"**) and `change.md`. Rewritten 2026-07-21 after shaping — the earlier
> „arkusz does ×(1+vat) on the wpłata" mechanic, the per-wpłata `{net,gross}` pair, **and the „legacy is
> excluded from Do zapłaty" idea are all dead** (see the legacy correction in `change.md`).

## Overview

Under **EX-536**, owner-confirmed 2026-07-21. The netto/brutto flag on a wpłata is a **bucket
classifier, not a converter** — no VAT is ever applied to a wpłata; VAT dolatuje tylko do reszty
zobowiązania. Sub-changes:

1. **Companion (separate issue, goes first):** restore `paymentMethod` (gotówka/przelew) to the forms.
   Orthogonal to netto/brutto — tracked as its own issue, listed here only for sequencing.
2. **Drop the stage link** — remove the `kosztorysStage` deposit→etap bridge end to end (a
   runtime-breaking column drop + a dead-code sweep). Independent of the VAT work.
3. **A wpłata carries a plane flag** — the transaction stores `amount` + a three-state
   `vatPlane: 'NET' | 'GROSS' | null` (INVESTOR_DEPOSIT only, create-only). It only routes the real
   amount into the netto or brutto bucket. **Legacy rows (`null`) still reduce „Do zapłaty"** — at face on
   both axes, exactly as the pre-change code did (see the calc model); they are never grossed.
4. **Do zapłaty netto / brutto in Podsumowanie** — the sequential model below, the four figures rendered
   as one locked, always-visible set (exempt from the `MoneyAxisToggle` hide).

Also in scope: **trim the deposit form picker (`DEPOSIT_UI_TYPES`) to `INVESTOR_DEPOSIT` only** — drop
„Inna wpłata" / „Zasilenie z konta firmowego" so no wpłata can be created outside the model. With the
picker closed at the source, the buckets and the „Do zapłaty" reducer see only investor wpłaty **by
construction** — no read-layer type filter needed. The wider union teardown stays parked at **EX-557**.

### The confirmed calc model (owner: „dokładnie")

```
R          = laborCostsNetFromKosztorys        robocizna wykonana, netto
sumNet     = Σ amount  WHERE vat_plane = 'NET'          (netto bucket — flagged)
sumGross   = Σ amount  WHERE vat_plane = 'GROSS'        (brutto bucket — flagged)
legacySum  = Σ amount  WHERE vat_plane IS NULL          (unflagged — legacy / old data)
baseLeft   = R − sumNet                        only a FLAGGED netto wpłata reduces the base pre-VAT

Do zapłaty netto  = baseLeft − legacySum                        legacy subtracts at face (as the old code did)
Do zapłaty brutto = baseLeft × (1 + vat) − sumGross − legacySum brutto wpłata + legacy both at face on the gross axis
```

**Legacy (`null`) is NOT in `baseLeft`** — it subtracts **at face on both axes**, exactly as the old
single `wplatyNet` did, so it never gets grossed. Only the flagged netto/brutto buckets drive the
sequential model. A legacy-only investment therefore shows the **same netto AND brutto as today** (netto
`R − legacy`, brutto `R×(1+vat) − legacy`); verified against prod (212 investor deposits / 6.19M zł, 45
live kosztorysy). **No division / `toNet` anywhere** — `toGross` runs only on `baseLeft`. Materiały (M)
keep today's treatment (added at face on both axes); materiały-plane is deferred (see „What We're NOT
Doing").

## Current State Analysis

- A transaction has **one immutable `amount`** (`transfers.ts:82-93`, `access.update:()=>false`), no
  plane flag. The only VAT source is per-investment `investments.vatRate` (default `DEFAULT_VAT = 0.08`),
  consumed today **only** by the kosztorys client-price plane.
- The kosztorys Podsumowanie renders wpłaty as a single face-value figure through the net/gross pair
  shape, forcing `gross === net` via `faceValue(wplatyNet)` (`kosztorys-summary.tsx:128`) + a `noBrutto`
  render flag. **`noBrutto` is shared** — the materiały breakdown rows also use it (`:172`,
  `summary-grid.tsx:53,100,114`); only the _wpłaty_ usage goes, the option stays.
- `wplatyNet` is fed today by `deriveFinancials().totalIncome`
  (`investment-financials.ts:43`), which sums **all three** DEPOSIT_TYPES at face. Trimming the picker to
  INVESTOR_DEPOSIT (above) is what keeps the buckets investor-only without a read filter; `totalIncome`
  itself (investment-view) is untouched.
- `MoneyAxisToggle` (`money-axis-toggle.tsx`) is the client-facing three-way **Netto / Brutto / Pokaż
  wszystko** view switcher; it gates rendering in **two places**: the collapsed headline in
  `kosztorys-totals-panel.tsx` (`axisShows(moneyAxis)`) and the expanded waterfall grid in
  `summary-grid.tsx` (`summaryMoneyCols` collapses whole columns). The four new figures must be exempt in
  **both**.
- The pair helpers `MoneyPairT` / `moneyPair()` / `faceValue()` live in `summary-economics.ts:3-16`;
  `toGross` in `calc.ts:63`. **No `toNet` is needed** under the bucket model. `faceValue`/`moneyPair` stay
  (used by rabat/`summaryLineFace`) — only the wpłaty call site changes.
- The stage link surfaces the per-etap „Wpłaty" row in `kosztorys-etap-totals.tsx:128-144` (the _only_
  feature the tag drives), fed by `sumDepositRowsForInvestment` (`sum-transfers.ts:256-275`, which
  `SELECT`s `kosztorys_stage_id`) → `zaliczki.ts` → `fetchZaliczkiByStage`
  (`reference-data.ts:250-263`, the _only_ `unstable_cache` wrapper + `CACHE_TAGS.transfers` wiring around
  the deposit read) → editor prop pass-through.
- `paymentMethod` already exists and is fully wired (`transfers.ts:115`, DB `payment_method`, types,
  queries, filters, mapping, schemas, export, actions; app-table column `transfers.tsx:158`). The forms
  hardcode `'CASH'` (`deposit-form.tsx:69`, `expense-form`, `internal-transfer-form`).
- **Collision warning:** on this branch **`kosztorys-summary.tsx` (Phase 3) and
  `kosztorys-totals-panel.tsx` (Phase 4) already carry uncommitted local edits** (editor hydration-gate
  work). Those two files — not `kosztorys-editor-body.tsx`, which is clean — must be reconciled by hand.

## Desired End State

- A new wpłata (INVESTOR_DEPOSIT) requires the owner to pick **netto or brutto**; the transaction stores
  `amount` + `vatPlane`. The real amount is never converted. The deposit picker offers only „Wpłata od
  inwestora".
- The kosztorys Podsumowanie shows **Wpłaty netto** and **Wpłaty brutto** (the two bucket sums) and
  **Do zapłaty netto** / **Do zapłaty brutto** per the sequential model — the four rendered as **one
  locked, visually distinct set, always visible**, identical in the collapsed headline and the expanded
  state, regardless of the `MoneyAxisToggle`. Rabat / Łącznie stay axis-gated as today.
- Legacy (`null`-plane) wpłaty **still reduce Do zapłaty** at face on both axes (identical to the
  pre-change code, never grossed); they may show as a separate amber „bez oznaczenia VAT" line, but that
  line **subtracts** — amber means „unmarked", never „excluded".
- A wpłaty list in the totals panel itemises every deposit: date, amount, its plane (netto/brutto),
  transaction link; legacy rows shown amber. Replaces the dropped per-etap „Wpłaty" row.
- The `kosztorysStage` column, form field, schema, action gate, validate-hook, read chain, and per-etap
  row are **gone**; no user-facing „zaliczka" string remains.

### Key Discoveries

- `sum-transfers.ts:256-275` — `sumDepositRowsForInvestment` is the one deposit read; it evolves
  (drops `kosztorys_stage_id`, gains `vat_plane`, then `id`+`date`). Keep the „raw rows, pure grouping
  downstream" shape (`:251-254`).
- **Cache replacement.** Phase 1 deletes `fetchZaliczkiByStage`, the _only_ cached wrapper around the
  deposit read. Phases 3/4 need a **new `unstable_cache` wrapper** (same `CACHE_TAGS.transfers` tag) around
  `sumDepositRowsForInvestment`, threaded to the three assemblers of the kosztorys editor data — including
  **`src/lib/queries/client-kosztorys.ts`** (the public share view), an easily-missed call site.
- `summary-economics.ts:67-78` — `computeDoZaplatyRM` currently takes `wplatyNet: number` and subtracts
  it at face on both planes; it must take the bucket reducer and apply the sequential model.
- `transfer-rules.ts:10-13` — predicates read membership arrays **lazily** (re-export cycle); any new
  type-gated condition must follow suit.
- Theme has no dedicated warning token — `--color-chart-orange` (#ff993b) is the amber; `text-chart-green`
  is the wpłaty green; `text-muted-foreground` the secondary.
- `lessons.md:79-80` — the deposit form's store hooks are recognised only by `use*` naming; keep the
  convention on any field extraction.

## What We're NOT Doing

- **No VAT math on any wpłata.** The flag routes; it never multiplies. `toNet` is not added.
- **No investment-view / balance change.** `deriveFinancials().totalIncome`
  (`investment-financials.ts:43`), `calculate-balance.ts`, and `financial-stats.tsx` keep summing the
  raw stored `amount`. The bucket model is a **kosztorys-Podsumowanie concern only**.
- **No „Policz bez VAT" obligation target (Wariant A).** Deferred — „if it's needed we will add it".
  Under B the split is driven purely by the tagged wpłaty; the unpaid remainder carries no plane.
- **No materiały netto/brutto** (`÷(1+vat)`), **no per-etap VAT coeff.** Bilans-inwestora slice, parked.
  Materiały stay at face value on both axes exactly as today.
- **No legacy backfill.** Old rows keep `vat_plane = NULL` — honest that we don't know their plane. The
  _reducer_ subtracts `null` at face from both Do zapłaty figures (so they still reduce Do zapłaty,
  identical to the old code); the DB is not rewritten.
- **No single-wpłata cash+invoice split** — a split is two transactions.
- **The flag is INVESTOR_DEPOSIT-only, enforced at the picker.** The union teardown of
  `COMPANY_FUNDING` / `OTHER_DEPOSIT` stays parked at **EX-557**; here we only remove them from
  `DEPOSIT_UI_TYPES`.
- Not touching `kosztorys_stages` (the stages themselves) or `CACHE_TAGS.kosztorysStages`.

## Implementation Approach

The **companion `paymentMethod`** task is orthogonal and lands first as its own issue. Within EX-536:
Phase 1 is an independent teardown (removes a feature, breaks nothing the later phases need). Phase 2
adds the flag storage + write path and trims the picker. Phase 3 wires the sequential model into the
Podsumowanie and lifts the four figures into their own always-visible block. Phase 4 builds the itemised
wpłaty list, filling the gap Phase 1 leaves. Each phase is separately reviewable; the two schema changes
are two hand-written migrations (per AGENTS.md — `migrate:create` snapshots are stale).

## Critical Implementation Details

- **Migration ordering & prod.** `transactions` is real prod data, but `kosztorys_stage_id` holds
  kosztorys-plane tags (throwaway per AGENTS.md), so the drop needs no preservation. The `vat_plane`
  add-column is additive + nullable (safe). Both apply to prod deliberately via `pnpm db:migrate:prod` by
  a human **before** the code that reads them ships — not during this local task.
- **`sumDepositRowsForInvestment` is shared and evolves.** Phase 1 removes its `kosztorys_stage_id`
  select; Phase 3 adds `vat_plane`; Phase 4 adds `id` + `date`. Its cached wrapper is re-created in
  Phase 3 (Phase 1 deleted the old one).
- **Legacy = `null`, subtracted at face, never a bucket.** A `null` plane is summed into `legacySum` and
  subtracted at face from **both** Do zapłaty figures — it is **not** in `baseLeft` (so it is never
  grossed) and never joins `sumNet`/`sumGross` as a labelled bucket. Only `'NET'`/`'GROSS'` rows carry a
  plane label and drive the sequential model.

---

## Companion (separate issue): restore `paymentMethod` (gotówka/przelew)

### Overview

Stop hardcoding `'CASH'` in the forms; let the owner pick the payment method, and trim the enum to two.
Orthogonal to the VAT work — filed and reviewed on its own, done first.

### Changes Required

- **Trim the enum** — `PAYMENT_METHODS` (`transfers.ts:44-49`) to `CASH` (Gotówka) + `TRANSFER`
  (Przelew) only. **First check existing rows** for `BLIK`/`CARD` values before removing them.
- **Expose the picker** — replace the hardcoded `paymentMethod: 'CASH'` in `deposit-form.tsx:69`,
  `expense-form.tsx`, `internal-transfer-form.tsx` with a Select bound to the trimmed enum.
- **Column visibility** — ensure the existing `paymentMethod` column (`transfers.tsx:158`) is visible in
  the app table.

### Success Criteria

- Creating a transaction lets you choose gotówka or przelew; the choice persists and shows in the table.
- No `BLIK`/`CARD` remains selectable; existing rows (if any carried them) handled deliberately.

---

## Phase 1: Stage-link teardown (`kosztorysStage`)

### Overview

Remove the deposit→etap bridge end to end: drop the column, strip all dead code, delete the per-etap
„Wpłaty" row and its tests. Runtime-breaking (the SQL select fails once the column is gone), so the
migration and the read change land together.

### Changes Required

#### 1. Migration — drop the column

**File**: `src/migrations/20260721_0_drop_kosztorys_stage_from_transactions.ts` (new)

**Intent**: Reverse `20260718_1` — drop `kosztorys_stage_id` and its index. No backfill (kosztorys-plane data).

**Contract**: `up` = `DROP COLUMN IF EXISTS kosztorys_stage_id` (+ drop index); `down` re-adds the
nullable FK column exactly as `20260718_1`'s `up`. Register in `src/migrations/index.ts`. Hand-written.

#### 2. Collection field

**File**: `src/collections/transfers.ts`

**Intent**: Remove the `kosztorysStage` relationship field (`:152-163`), including the „Zaliczka na etap"
label — the last user-facing „zaliczka" string.

**Contract**: Delete the field object; verify no other reference remains in the collection.

#### 3. Deposit form

**File**: `src/components/forms/deposit-form/deposit-form.tsx`

**Intent**: Remove the stage Select, the `NO_STAGE` sentinel, the `kosztorysStage` form value + `toData`
mapping, the `resetField('kosztorysStage')` listeners, and the `investmentStages` derivation.

**Contract**: `FormValuesT` loses `kosztorysStage` (`:45-48`); `defaultValues` (`:72`); `toData`
(`:86-89`); the two `resetField` listeners (`:107-108`, `:138`) and the stage-Select block (`:142-156`).
Keep the `use*` hook-naming convention intact.

#### 4. Schema + action + validate hook

**File**: `src/lib/schemas/transfer.ts`, `src/lib/actions/transfers.ts`,
`src/lib/schemas/transfer-validation.ts` + `src/hooks/transfers/validate.ts`,
`src/components/forms/expense-form/expense-schema.ts` if it carries the field

**Intent**: Strip `kosztorysStage` from the create schema (`transfer.ts:29`), the action's
stage-membership check (`transfers.ts:47-62`), and the validate hook's deposit-only gate +
null-on-non-deposit + orphan-clear (`transfer-validation.ts:23,67-69`, `validate.ts:108-129`).

**Contract**: All `kosztorysStage` references removed; the action no longer validates a stage belongs to
the investment.

#### 5. Reference-data plumbing + read chain

**File**: `src/types/reference-data.ts`, `src/lib/queries/reference-data.ts`,
`src/lib/kosztorys/zaliczki.ts` (delete), `src/lib/db/sum-transfers.ts`

**Intent**: Remove `kosztorysStagesByInvestment` (`reference-data.ts:58-59`,
`queries/reference-data.ts:93,150-186`) and the whole `fetchZaliczkiByStage` chain
(`queries/reference-data.ts:250-263`); delete `zaliczki.ts`. In `sumDepositRowsForInvestment`
(`sum-transfers.ts:256-275`) drop the `kosztorys_stage_id` select and the `kosztorysStage` field.
**Note the deleted `fetchZaliczkiByStage` is the only cached deposit-read wrapper** — Phase 3 re-creates
one; do not silently leave the read uncached.

**Contract**: `ReferenceDataT` loses `kosztorysStagesByInvestment`; `zaliczkiByStage` leaves
`kosztorys/types.ts:124` and the editor prop chain (`kosztorys-editor-v2.tsx`,
`kosztorys-editor-body.tsx`, `kosztorys-totals-panel.tsx`). **Reconcile `kosztorys-totals-panel.tsx`
against its uncommitted local edits** (see collision warning).

#### 6. Per-etap „Wpłaty" row + tests

**File**: `src/components/kosztorys/kosztorys-etap-totals.tsx`, plus test deletions

**Intent**: Remove the `zaliczkiByStage`/`wplatyNet`/`pozaEtapem` props and the whole „Wpłaty" row
(`:25-31,58-61,128-144`) and the „Bez etapu" bucket logic. The Netto/Brutto per-etap grid stays.
(Phase 4 adds the replacement list; this phase leaves the gap.)

**Contract**: `PropsT` loses `zaliczkiByStage`, `wplatyNet`; `investmentId`/`clientView` stay only if
Phase 4 reuses them. Delete tests: `transfer-schema.test.ts:446-472`, `validate-hook.test.ts:153-209`,
`hooks/orphaned-etap-tag.db.test.ts` (whole), `lib/kosztorys/zaliczki.test.ts` (whole). Trim
`kosztorysStagesByInvestment:{}` stubs in `default-cash-register`/`dashboard-aggregation`/`transfer-table`
tests. **Keep** `summary-economics.test.ts:52-62` in Phase 1 (Phase 3 rewrites them to the new
`computeDoZaplatyRM` signature — see Phase 3's F2 test-update).

### Success Criteria

#### Automated Verification

- Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit`
- Lint passes: `pnpm lint`
- Unit tests pass: `pnpm exec vitest run`
- `grep -rn "kosztorysStage\|zaliczkiByStage\|fetchZaliczkiByStage\|kosztorysStagesByInvestment" src/` returns nothing
- `grep -rin "zaliczk" src/components src/collections` returns no user-facing string

#### Manual Verification

- Deposit form renders without a stage Select; a wpłata saves and appears on the investment.
- Kosztorys editor totals panel loads (per-etap Netto/Brutto grid intact, no „Wpłaty" row) — verified
  against the branch's local editor edits.
- No console/SQL error on the kosztorys page after the column drop.

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: Plane flag — storage + write path + picker trim

### Overview

Add the three-state `vatPlane` flag (INVESTOR_DEPOSIT only), require the choice in the form, and trim the
deposit picker to INVESTOR_DEPOSIT. Storage + write path only — no summary math yet.

### Changes Required

#### 1. Migration — add the flag

**File**: `src/migrations/20260721_1_add_vat_plane_to_transactions.ts` (new)

**Intent**: Add a nullable `vat_plane varchar` with a `CHECK (vat_plane IN ('NET','GROSS'))`. Nullable by
design — legacy rows stay NULL; no default, no backfill.

**Contract**: `up` = `ADD COLUMN IF NOT EXISTS vat_plane varchar` + add the CHECK constraint; `down` =
drop constraint + `DROP COLUMN IF EXISTS vat_plane`. Register in `index.ts`. Hand-written.

#### 2. Collection field

**File**: `src/collections/transfers.ts`

**Intent**: Add `vatPlane` — a create-only `select` (`'NET'` / `'GROSS'`) shown only for
`INVESTOR_DEPOSIT`, mirroring `amount`'s immutability.

**Contract**: `type: 'select'`, `options: ['NET','GROSS']`; `access.update:()=>false`;
`admin.condition = (data) => typeOf(data) === 'INVESTOR_DEPOSIT'` (lazy-read pattern); PL label
„Wpłata netto czy brutto". **Not** `required` at the collection level (legacy rows are NULL); the form
enforces it for new rows. A three-state union (not a nullable boolean) so `null` can never collapse into
`'NET'` under a `!flag` shortcut.

#### 3. Trim the deposit picker

**File**: `src/lib/constants/transfers.ts`

**Intent**: Reduce `DEPOSIT_UI_TYPES` to `['INVESTOR_DEPOSIT']` — remove „Inna wpłata" / „Zasilenie z
konta firmowego" from the deposit dialog so no wpłata can be created outside the model.

**Contract**: `DEPOSIT_UI_TYPES = ['INVESTOR_DEPOSIT']`. `DEPOSIT_TYPES` (the read-side membership array)
stays untouched — the union teardown is EX-557. Verify the deposit form's type Select still renders with
a single option (or hides the Select and pins the type).

#### 4. Create schema + form

**File**: `src/lib/schemas/transfer.ts`, `src/components/forms/expense-form/expense-schema.ts` (shared by
the deposit form), `src/components/forms/deposit-form/deposit-form.tsx`

**Intent**: Add `vatPlane: 'NET' | 'GROSS'` to the create path, **required for INVESTOR_DEPOSIT**. Add a
netto/brutto radio/Select to the deposit form (shown for INVESTOR_DEPOSIT), default unselected so the
owner must choose, and map it in `toData`.

**Contract**: Schema refinement rejects a missing plane when `type === 'INVESTOR_DEPOSIT'` (beside
`getAmountError`, `validation.ts`). Form: a new field via `form-fields` following the `use*` convention;
`toData` maps the value. `updateTransferSchema` does **not** accept `vatPlane` (immutable).

### Success Criteria

#### Automated Verification

- Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit`
- Lint passes: `pnpm lint`
- Unit tests pass: `pnpm exec vitest run`
- New unit test: create-schema rejects a missing `vatPlane` for INVESTOR_DEPOSIT, accepts NULL for
  other types. Run: `pnpm exec vitest run src/lib/schemas`

#### Manual Verification

- The deposit dialog offers only „Wpłata od inwestora".
- Creating an INVESTOR_DEPOSIT forces a netto/brutto choice; omitting it blocks submit.
- The stored row carries `vat_plane`; a non-deposit transaction leaves it NULL.

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Sequential model in the Podsumowanie

### Overview

Turn the bucket sums into **Wpłaty netto / Wpłaty brutto** and **Do zapłaty netto / Do zapłaty brutto**
per the confirmed model, and lift the four into one locked, always-visible block exempt from the
`MoneyAxisToggle` hide in **both** render paths (collapsed headline + expanded grid).

### Changes Required

#### 1. Bucket sums from the deposit read (+ re-cache)

**File**: `src/lib/db/sum-transfers.ts`, a new cached wrapper, and the pure helper feeding the summary

**Intent**: `sumDepositRowsForInvestment` selects `vat_plane`; a pure helper reduces the rows to
`{ sumNet, sumGross, legacySum }` — `vat_plane === 'NET' → sumNet`; `=== 'GROSS' → sumGross`;
`NULL → legacySum`. Re-create a `unstable_cache` wrapper (tag `CACHE_TAGS.transfers`) around the read to
replace the deleted `fetchZaliczkiByStage`, and thread it to the three kosztorys-data assemblers,
**including `src/lib/queries/client-kosztorys.ts`**. Cancelled rows already excluded.

**Contract**: The value threaded into the summary changes from `wplatyNet: number` to
`{ sumNet, sumGross, legacySum }`. VAT rate comes from the investment (already on the kosztorys read).

#### 2. `computeDoZaplatyRM` — sequential model

**File**: `src/lib/kosztorys/summary-economics.ts`

**Intent**: Replace the single-`wplatyNet` subtraction with the bucket model. **Legacy is NOT in
`baseLeft`** — only the flagged netto bucket reduces the base pre-VAT; legacy subtracts at face on both
axes (exactly as the old code), so it never gets grossed:

```
baseLeft = laborCostsNetFromKosztorys − sumNet
net   = baseLeft − legacySum + materialyNet
gross = baseLeft × (1 + vatRate) − sumGross − legacySum + materialyNet
```

**Contract**: `computeDoZaplatyRM(laborCostsNetFromKosztorys, { sumNet, sumGross, legacySum }, materialyNet, vatRate)`
returning `MoneyPairT { net, gross }`. `toGross` runs only on `baseLeft`. Materiały added at face on both
axes (unchanged). **Legacy at face on both axes** — a legacy-only investment yields the _same_ net and
gross as today's `R − wplaty` / `toGross(R) − wplaty` (this is what keeps the old code's behaviour intact;
no brutto-axis shift). Overpaid (negative) state preserved. **Do not claim the visible waterfall columns
still „foot" on both axes** — under the sequential model the gross column no longer equals
`Łącznie − rabat − wpłaty` (it's short by `sumNet × vat`, by design); reword the stale
`kosztorys-summary.tsx:124-126` comment accordingly — the four figures come from this model, not from
naive per-row column subtraction.

**Update the existing test.** `summary-economics.test.ts` has assertions calling `computeDoZaplatyRM`
with the old `(net, wplatyNet, mat, vat)` signature; migrate them to `{ sumNet, sumGross, legacySum }` and
add the legacy-at-face case (below). (Phase 1 keeps this file; it _evolves_ here, not stays frozen.)

#### 3. Summary component — four figures as one locked, hide-exempt block

**File**: `src/components/kosztorys/kosztorys-summary.tsx`, `src/components/kosztorys/kosztorys-totals-panel.tsx`

**Intent**: Replace the single `faceValue(wplatyNet)` wpłaty row (`:128`, drop _only its_ `noBrutto`
usage) with a dedicated block holding **Wpłaty netto** (`sumNet`), **Wpłaty brutto** (`sumGross`),
**Do zapłaty netto** and **Do zapłaty brutto** (from `computeDoZaplatyRM`). The four are **one locked
set**, lifted **out of the axis-gated waterfall grid** into their own visually distinct block, rendered
**identically in the collapsed headline (`kosztorys-totals-panel.tsx`) and the expanded state** from one
source — so the two render paths cannot drift and the `MoneyAxisToggle` cannot hide any of them. Show
`legacySum` as a separate amber line when non-zero (it still reduced the base). Rabat / Łącznie stay
axis-gated in the waterfall.

**Contract**: The wpłaty prop on `KosztorysSummary` becomes `{ sumNet, sumGross, legacySum }`; update its
call sites. The four figures live outside `summaryMoneyCols` / `axisShows` gating in both components.
**Reconcile both files against their uncommitted local edits** (collision warning).

### Success Criteria

#### Automated Verification

- Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit`
- Lint passes: `pnpm lint`
- Unit tests pass: `pnpm exec vitest run`
- New/updated unit tests: the bucket reducer maps NET/GROSS/NULL to `sumNet`/`sumGross`/`legacySum`;
  `computeDoZaplatyRM` yields `net = R − sumNet − legacySum + M` and
  `gross = (R − sumNet)×(1+vat) − sumGross − legacySum + M`, incl. the owner example (R 2000, sumNet 1000
  → net 1000, gross 1080) **and** a legacy-only case (R 2000, legacySum 1000 → net 1000, gross **1160** =
  today's `toGross(R) − wplaty`, both axes unchanged). Run: `pnpm exec vitest run src/lib/kosztorys`

#### Manual Verification

- A netto-flagged 1000 wpłata against robocizna 2000 shows Wpłaty netto 1000, Do zapłaty netto 1000, Do
  zapłaty brutto 1080.
- A later brutto-flagged 1080 wpłata drives Do zapłaty brutto to 0.
- Switching `MoneyAxisToggle` to Netto or Brutto **does not hide** the four figures, in both the
  collapsed and expanded states, and both states show the same numbers.
- **Before/after on a real investment with legacy deposits:** open a live kosztorys whose investor
  deposits predate the flag; both „Do zapłaty netto" **and** „Do zapłaty brutto" match the pre-change
  figures (legacy subtracted at face on both axes, no upward jump), and the amber legacy line shows their sum.

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Wpłaty list surface

### Overview

Add a „Wpłaty" section to the totals panel: a flat list of every investment wpłata with date, amount, its
plane (netto/brutto), and a transaction link; legacy rows amber. Replaces the dropped per-etap row.

### Changes Required

#### 1. Deposit read → per-wpłata rows

**File**: `src/lib/db/sum-transfers.ts` (or a sibling read)

**Intent**: Extend the deposit read to return per-wpłata rows: `id`, `date`, `amount`, `vatPlane`.

**Contract**: A `WplataListRowT[]` shape reused by the component; VAT rate not needed here (no
conversion). Cancelled rows excluded. Served through the Phase 3 cached wrapper.

#### 2. Wpłaty list component

**File**: `src/components/kosztorys/kosztorys-wplaty-list.tsx` (new) — colocate its `PropsT`

**Intent**: Render each wpłata: date, amount, and its plane tag — **netto / brutto `text-chart-green`**
(both are real amounts; distinguish by a netto/brutto label, not a muted axis), **legacy (NULL)
`text-chart-orange`** amber. Each row links to `/inwestycje/{id}?type=INVESTOR_DEPOSIT` (or the specific
transaction), gated `clientView` to plain text like the sibling Podsumowanie link.

**Contract**: Its own section block below the etap-totals grid in `kosztorys-totals-panel.tsx`, matching
the panel's border/`text-sm` rhythm. Sheet-name UI label „Wpłaty". Tailwind v4 utilities only — no inline
colour styles.

#### 3. Wire into the totals panel

**File**: `src/components/kosztorys/kosztorys-totals-panel.tsx` (+ prop chain from the kosztorys page)

**Intent**: Thread the wpłaty-list rows from the server read to the new component; render it where the old
per-etap row was.

**Contract**: New prop on the panel + editor body; **reconcile with the branch's local
`kosztorys-totals-panel.tsx` edits.**

### Success Criteria

#### Automated Verification

- Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit`
- Lint passes: `pnpm lint`
- Unit tests pass: `pnpm exec vitest run`
- Tailwind v4 audit clean (no `var(--…)` in `[...]`, no inline colour style) on the new component

#### Manual Verification

- The totals panel shows a wpłaty list: each row has date, amount, its netto/brutto tag, and a working
  transaction link (owner view) / plain text (client view).
- Legacy rows read amber; netto/brutto rows read correctly.
- The list reconciles with the Podsumowanie Wpłaty netto/brutto sums (plus the amber legacy line).

**Implementation Note**: Final phase — after automated verification, `/10x-implement` aggregates the
manual bullets into `context/foundation/manual-checks.md`.

---

## Testing Strategy

### Unit Tests

- Bucket reducer: `'NET'` → `sumNet`, `'GROSS'` → `sumGross`, `NULL` → `legacySum` (never a bucket).
- `computeDoZaplatyRM`: `net = R − sumNet − legacySum + M`;
  `gross = (R − sumNet)×(1+vat) − sumGross − legacySum + M`; owner example (2000 / 1000 netto → 1000 /
  1080); **legacy-only case** (2000 / 1000 legacy → net 1000, gross **1160** = today's `toGross(R)−wpłaty`,
  both axes unchanged); overpaid (negative) state preserved.
- Create-schema rejects a missing `vatPlane` for INVESTOR_DEPOSIT; accepts NULL for other types.

### Integration Tests

- Deleting the Phase 1 tests; no new DB-integration test required unless the bucket read warrants one.

### Manual Testing Steps

1. Create a netto wpłata then a brutto wpłata against a known robocizna; verify the four Podsumowanie
   figures and the toggle-exemption in both collapsed and expanded states.
2. Confirm a legacy deposit still reduces „Do zapłaty netto" and shows in the amber legacy line.
3. Verify the wpłaty list links, tags, and client-view text gate.

## Performance Considerations

Deposit count per investment is small (research §5); raw-rows-then-pure-grouping is fine. No new hotspot.

## Migration Notes

Two hand-written migrations (drop `kosztorys_stage_id`, add `vat_plane`). Applied to prod by a human via
`pnpm db:migrate:prod` before the code ships — not during this local task. Kosztorys-plane data (the stage
tags) is throwaway; no backfill for either migration.

## References

- Calc model + owner decisions: `context/changes/kosztorys-zaliczka-netto-brutto/design-bilans-vat-planes.md`
- Research: `context/changes/kosztorys-zaliczka-netto-brutto/research.md`
- Change identity: `context/changes/kosztorys-zaliczka-netto-brutto/change.md`
- Deposit-type teardown: **EX-557**
- Two-plane VAT doctrine: `context/reference/kosztorys-editor-domain-notes.md:280-306`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename
> step titles. See `references/progress-format.md`.

### Phase 1: Stage-link teardown

#### Automated

- [x] 1.1 Type checking passes (`pnpm generate:types && pnpm exec tsc --noEmit`) — ae3125b3
- [x] 1.2 Lint passes (`pnpm lint`) — ae3125b3
- [x] 1.3 Unit tests pass (`pnpm exec vitest run`) — ae3125b3
- [x] 1.4 No `kosztorysStage`/`zaliczkiByStage`/`fetchZaliczkiByStage`/`kosztorysStagesByInvestment` references remain in `src/` — ae3125b3
- [x] 1.5 No user-facing „zaliczk" string in `src/components`/`src/collections` — ae3125b3

### Phase 2: Plane flag — storage + write path + picker trim

#### Automated

- [x] 2.1 Type checking passes (`pnpm generate:types && pnpm exec tsc --noEmit`) — cde895bd
- [x] 2.2 Lint passes (`pnpm lint`) — cde895bd
- [x] 2.3 Unit tests pass (`pnpm exec vitest run`) — cde895bd
- [x] 2.4 New unit test passes: create-schema requires `vatPlane` for INVESTOR_DEPOSIT (`pnpm exec vitest run src/__tests__/transfer-schema.test.ts`) — cde895bd

### Phase 3: Sequential model in the Podsumowanie

#### Automated

- [x] 3.1 Type checking passes (`pnpm generate:types && pnpm exec tsc --noEmit`) — dba4aa83
- [x] 3.2 Lint passes (`pnpm lint`) — dba4aa83
- [x] 3.3 Unit tests pass (`pnpm exec vitest run`) — dba4aa83
- [x] 3.4 New unit tests pass: bucket reducer + `computeDoZaplatyRM` sequential model incl. owner example + legacy-only case (`pnpm exec vitest run src/lib/kosztorys`) — dba4aa83

### Phase 4: Wpłaty list surface

#### Automated

- [x] 4.1 Type checking passes (`pnpm generate:types && pnpm exec tsc --noEmit`) — ddaf802a
- [x] 4.2 Lint passes (`pnpm lint`) — ddaf802a
- [x] 4.3 Unit tests pass (`pnpm exec vitest run`) — ddaf802a
- [x] 4.4 Tailwind v4 audit clean on the new wpłaty-list component — ddaf802a
