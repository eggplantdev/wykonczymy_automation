# Podsumowanie podwykonawców — osobny blok podsumowania dla widoków Z/Bez narzędzi — Implementation Plan

## Overview

Split the single shared Editor V2 footer summary by price view. The **Klient** view keeps today's
`KosztorysSummary` unchanged; the two subcontractor views (**Z narzędziami** / **Bez narzędzi**) get a
new **„Podsumowanie podwykonawców"** block that counts the cost side — what the crew is owed from the
kosztorys vs how much has already been paid out. Realizes **EX-554**, closes **EX-551** (model:
robocizna = cena klienta, wypłaty = cena podwykonawcy, marża = robocizna − wypłaty).

The new block shows three figures, one „Kwota" column, no netto/brutto axis (EX-558: subcontractors
paid without VAT):

- **Suma wykonanej pracy** (należne) = Σ subcontractor price of _executed_ works at the active view's
  price, **pre-rabat**.
- **Zaliczki (wypłaty)** = realized PAYOUT transfers on this investment, grouped per worker (each a
  link), then **Zaliczki (wypłaty) razem**.
- **Pozostało do wypłaty** = Suma wykonanej pracy − Zaliczki razem (may go negative).

## Current State Analysis

- One block, `KosztorysSummary` (`kosztorys-summary.tsx:93`), renders identically in all three views —
  only the robocizna waterfall reprices per view underneath. Materiały / Wpłaty / Rabat / Do zapłaty /
  the recon scream are **client-plane** concepts with no meaning on the subcontractor plane. Single
  call site: `kosztorys-totals-panel.tsx:121`.
- **„Suma wykonanej pracy" (należne, pre-rabat) is NOT `totalNet` and NOT `laborCostsNetFromKosztorys`.**
  `sectionSubtotalsForView(rows, stages, view)` sums executed qty (`rowTotalQtyDone` = Σ stage cells,
  EX-494) at the view price, but `acc.net` runs through `netForQtyForView` → `applyDiscount`, so it is
  **post per-item rabat** (`settlement.ts:194`, `calc.ts:72-75,25-33`). `laborCostsNetFromKosztorys =
totalNet − globalDiscountAmount` subtracts the **global** discount on top (`use-kosztorys-editor.ts`
  ~380). Rabat is a client concession absorbed by the company margin — the crew is owed its price
  regardless (owner, przed rabatem). So należne = **`Σ(subtotals.net + subtotals.discount)`** over the
  active-view subtotals — the same `net + discount` construction `clientTotalsFromSubtotals` uses for
  `sumaPracNet` (`settlement.ts:62-66`). Under a global discount `net` is already gross and `discount`
  is 0, so the identity still holds.
- **PAYOUT per worker × investment does not exist as a query.** `sum-transfers.ts` has
  `sumAllWorkerBalances` (`:112`, `GROUP BY worker_id`, lifetime, no investment) and per-investment
  totals (`:138`), never crossed. `worker` is a PAYOUT-only, write-once relationship to `users`
  (`transfers.ts:174`). ~11% of investment PAYOUTs have no worker → they must still count (else Σ
  zaliczek ≠ the cash sum) as a „Bez przypisanego pracownika" bucket.
- **Worker names are not SQL-joined anywhere.** Convention: query returns ids + amounts; names resolve
  from `fetchReferenceData().workers.find(...)` (`reference-data.ts:129-138`; pracownicy page
  `[id]/page.tsx:38`). The kosztorys page already fetches `fetchReferenceData` (`kosztorys_v2/page.tsx`
  ~line 37).
- **No `worker` URL filter yet.** `?type=PAYOUT` works today; `buildTransferFilters`
  (`transfer-filters.ts:60-172`) has no `worker` block. `worker: { equals: id }` is a valid Payload
  Where (pracownicy `[id]/page.tsx:28`). Adding it makes `/inwestycje/{id}?type=PAYOUT&worker=<id>`
  work (the per-worker link target).
- **Prop chain:** `kosztorys_v2/page.tsx` → `KosztorysEditorV2` → `KosztorysEditorBody` →
  `KosztorysTotalsPanel` → footer. `KosztorysEditorDataT` (`kosztorys/types.ts:117`) is also built by two
  read-only entry points (`(share)/k/[token]`, `(share)/podglad-klienta/[id]`) — both always
  client-view (`clientView` pins `priceView` to `'client'`), so the subcontractor block never renders
  there. The new prop is therefore **optional** (default `[]`) and the share pages stay untouched.
- **`moneyAxis` is structural in `SummaryRow`** — cell count derives from `summaryMoneyCols(axis)`
  (`summary-grid.tsx`). The new single-„Kwota" block must not reuse `SummaryRow`; it uses the exported
  `SUMMARY_LABEL_COL` / `SUMMARY_VALUE_COL` / `SUMMARY_LABEL_CELL` / `SUMMARY_VALUE_CELL` constants for
  column alignment with the client block above. The netto/brutto toggle control must be hidden in the
  subcontractor views.

## Desired End State

- Toggling to **Z narzędziami** or **Bez narzędzi** replaces the client Podsumowanie with
  „Podsumowanie podwykonawców": one „Kwota" column, `Suma wykonanej pracy` (pre-rabat, active view's
  subcontractor price) → per-worker `Zaliczki (wypłaty)` with links → `Zaliczki (wypłaty) razem` →
  `Pozostało do wypłaty`. The **Klient** view is byte-for-byte unchanged.
- A per-worker row links to `/inwestycje/{id}?type=PAYOUT&worker=<id>`; a null-worker bucket „Bez
  przypisanego pracownika" sums the unattributed PAYOUTs (no link).
- The netto/brutto toggle does not render in the subcontractor views.

### Key Discoveries

- `settlement.ts:55-69` — `net + discount` is the established pre-rabat construction; the new należne
  helper mirrors it over the **active-view** subtotals, not the client ones.
- `sum-transfers.ts:112-132` — `sumAllWorkerBalances` is the query template; add `AND investment_id`,
  **keep** null `worker_id` (do NOT add `worker_id IS NOT NULL`).
- `reference-data.ts:255-265` — `fetchZaliczkiByStage` is the exact `unstable_cache` wrapper template
  (key `[tag, String(investmentId)]`, `tags: [CACHE_TAGS.transfers]`, returns a plain array/Record
  across the server→client boundary). Names are joined at the page, not in the cached query, so the
  `users` tag is not needed on it.
- `transfer-filters.ts:136-139` — the `expenseCategory` block is the shape to copy for `worker`.
- Naming (AGENTS.md glossary): podwykonawca has a clean English equivalent → **English code**
  (`SubcontractorSummary`, `fetchPayoutsByWorkerForInvestment`, `subcontractorDueNet`), Polish UI label
  „Podsumowanie podwykonawców". Sheet terms live in code comments only.

## What We're NOT Doing

- **No per-crew / per-worker attribution of the WORK.** There is zero worker↔kosztorys link (item,
  section, stage, progress) and no „ekipa" entity. `Suma wykonanej pracy` and Σ zaliczek are both
  whole-investment figures, so `Pozostało do wypłaty` is the **łączna** amount for the whole build — it
  deliberately does not say „komu ile jeszcze". Per-crew attribution is a separate, larger future slice
  (new schema + assignment UI). Owner accepts this scope.
- **No materiały / marża** in the subcontractor block (materiały is a separate register; marża stays a
  concern of the investment card).
- **No netto/brutto axis** in the subcontractor block (EX-558). The toggle stays only in the Klient
  view.
- **No PAYOUTs without an investment** (~5% historically) — invisible here, by design.
- **No change to the Klient view**, to `investment-financials` / balance, or to any transfer write path.
- **No data migration** — this is read-only over existing transfers + kosztorys rows.

## Implementation Approach

Three phases. Phase 1 (server figure) and Phase 2 (worker URL filter) are independent and can land in
either order. Phase 3 builds the component on both. No schema change, no migration. All money
arithmetic lives in pure helpers (unit-tested); the component is plumbing.

## Critical Implementation Details

- **Należne is pre-rabat over the ACTIVE view** — `Σ(subtotals.net + subtotals.discount)` where
  `subtotals = sectionSubtotalsForView(rows, stages, view)` at the active `view`. Never `totalNet`
  (per-item rabat baked in) or `laborCostsNetFromKosztorys` (global discount too).
- **The PAYOUT query keeps null workers** — a null `worker_id` row is a real cash payout that must
  count toward Σ zaliczek, or `Pozostało do wypłaty` overstates the debt. Bucket it as „Bez
  przypisanego pracownika".
- **Names join at the page, not in the cached query** — query returns `{ workerId: number | null;
total: number }[]`; the server component enriches with `refData.workers` before threading down. Keeps
  the cache tagged on `transfers` alone.
- **Cancelled excluded** — `cancelled IS NOT TRUE`, like every sibling sum.
- **New prop is optional** — default `[]`; the two share entry points (always client view) don't supply
  it and don't render the block.

---

## Phase 1: Server figure — PAYOUT per worker × investment

### Overview

A new cached read summing this investment's realized PAYOUTs grouped by worker (null worker kept), name
resolution at the page, threaded through the editor prop chain as an optional prop.

### Changes Required

#### 1. SQL sum

**File**: `src/lib/db/sum-transfers.ts`

**Intent**: `sumPayoutsByWorkerForInvestment(payload, investmentId)` — mirror `sumAllWorkerBalances`
(`:112-132`) plus `AND investment_id = ${investmentId}`; `GROUP BY worker_id` **without** a
`worker_id IS NOT NULL` guard so the null bucket survives.

**Contract**: `WHERE type = 'PAYOUT' AND investment_id = ${investmentId} AND cancelled IS NOT TRUE`.
Returns `PayoutByWorkerT[]` = `{ workerId: number | null; total: number }[]`. `perfStart` timing +
tagged `sql` interpolation, matching the file's convention.

#### 2. Cached fetch wrapper

**File**: `src/lib/queries/reference-data.ts` (+ shape in `src/types/reference-data.ts`)

**Intent**: `fetchPayoutsByWorkerForInvestment(investmentId)` — `unstable_cache` wrapper mirroring
`fetchZaliczkiByStage` (`:255-265`): key `['payouts-by-worker', String(investmentId)]`, `tags:
[CACHE_TAGS.transfers]`, returns a plain array (crosses server→client). No `users` tag (names join at
the page).

**Contract**: Revalidation already covered — `recalculate-balances.ts:36,60` fires
`revalidateTag(CACHE_TAGS.transfers)` on transfer mutations.

#### 3. Thread through page + prop chain

**File**: `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx`,
`src/lib/kosztorys/types.ts`, `kosztorys-editor-v2.tsx`, `kosztorys-editor-body.tsx`,
`kosztorys-totals-panel.tsx`

**Intent**: Fetch `fetchPayoutsByWorkerForInvestment(investmentId)` alongside the existing promises;
enrich each row with a name from `refData.workers` (null → „Bez przypisanego pracownika") into
`SubcontractorPayoutRowT` = `{ workerId: number | null; name: string; total: number }`; add an
**optional** `payoutsByWorker?: SubcontractorPayoutRowT[]` (default `[]`) to `KosztorysEditorDataT` and
thread editor-v2 → body → panel.

**Contract**: The two share entry points (`(share)/k/[token]`, `(share)/podglad-klienta/[id]`) are NOT
touched — the field is optional and their client view never renders the block.

### Success Criteria

#### Automated Verification

- Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit`
- Lint passes: `pnpm lint`
- Unit tests pass: `pnpm exec vitest run`
- New DB-integration test (5435 container) for `sumPayoutsByWorkerForInvestment`: groups by worker,
  **includes the null-worker bucket**, excludes cancelled, excludes non-PAYOUT, filters by investment.
  Run: `pnpm exec vitest run src/__tests__/lib/db` (self-cleaning fixtures, gated on
  `DB_POSTGRES_URL`/`PAYLOAD_SECRET`).

#### Manual Verification

- On an investment with PAYOUTs across several workers (dev/test DB), the enriched rows carry correct
  names and per-worker totals; a null-worker payout appears under „Bez przypisanego pracownika".

**Implementation Note**: Pause for manual confirmation before Phase 3 (Phase 2 is independent).

---

## Phase 2: `worker` URL filter

### Overview

Add a `worker` param to the transfer filter builder so the per-worker link
`/inwestycje/{id}?type=PAYOUT&worker=<id>` narrows to that worker's payouts.

### Changes Required

#### 1. Filter builder

**File**: `src/lib/queries/transfer-filters.ts`

**Intent**: Add a `searchParams.worker` block mirroring `expenseCategory` (`:136-139`) →
`worker: { equals: Number(worker) }`.

**Contract**: Invalid/empty `worker` ignored (same tolerance as the sibling blocks);
`stripCancelledFilters` already passes unknown keys through, so the investment page's header stats
narrow consistently with the list.

### Success Criteria

#### Automated Verification

- Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit`
- Lint passes: `pnpm lint`
- New unit test: `buildTransferFilters({ worker: '5' })` yields `worker: { equals: 5 }`; absent/invalid
  `worker` yields no worker clause. Run: `pnpm exec vitest run src/__tests__/lib/queries`

#### Manual Verification

- Visiting `/inwestycje/{id}?type=PAYOUT&worker=<id>` lists only that worker's payouts on that
  investment.

---

## Phase 3: `SubcontractorSummary` block + panel branch

### Overview

A new footer block for the subcontractor views, selected by `priceView`, with the pre-rabat należne
figure, per-worker zaliczki + links, razem, and pozostało — single „Kwota" column, no `moneyAxis`.

### Changes Required

#### 1. Pre-rabat należne helper

**File**: `src/lib/kosztorys/settlement.ts`

**Intent**: `executedWorkNetPreRabat(subtotals: SectionSubtotalT[]) = Σ(net + discount)` — the pre-rabat
executed value over the ACTIVE-view subtotals (mirrors `clientTotalsFromSubtotals`'s `sumaPracNet`,
but view-agnostic and without the global-discount add-back, since należne carries no discount at all).

**Contract**: Pure; unit-tested for per-item-rabat and global-discount rows (both must yield the
pre-rabat sum).

#### 2. Thread the należne scalar

**File**: `src/components/kosztorys/use-kosztorys-editor.ts` (or `kosztorys-editor-body.tsx`),
`kosztorys-totals-panel.tsx`

**Intent**: Derive `subcontractorDueNet = executedWorkNetPreRabat(subtotals)` from the hook's
active-view `subtotals` (`use-kosztorys-editor.ts:312`) and thread it to the panel → new component.

**Contract**: Reactive to unsaved edits like the other hook-derived figures.

#### 3. Pure block-figure helper

**File**: `src/lib/kosztorys/subcontractor-summary.ts` (new)

**Intent**: `computeSubcontractorSummary(dueNet, payouts) → { dueNet; payoutsTotal; remaining;
rows }` where `payoutsTotal = Σ payouts.total`, `remaining = dueNet − payoutsTotal` (may be negative),
`rows` sorted by `total` desc with the null-worker bucket last.

**Contract**: Pure; unit-tested for the four edge cases (negative remaining, empty payouts, null-worker
bucket, zero executed).

#### 4. `SubcontractorSummary` component

**File**: `src/components/kosztorys/subcontractor-summary.tsx` (new) — colocate `PropsT`

**Intent**: Render the block with the exported `SUMMARY_*` constants for alignment; no `SummaryRow`, no
`moneyAxis`. Rows: „Suma wykonanej pracy" (dueNet) → group „Zaliczki (wypłaty)" (per worker: name +
`−total`, link `/inwestycje/{id}?type=PAYOUT&worker=<id>`; null bucket „Bez przypisanego pracownika",
no link) → „Zaliczki (wypłaty) razem" (`−payoutsTotal`) → „Pozostało do wypłaty" (`remaining`, negative
state visually distinct). Empty payouts → „Zaliczki (wypłaty) razem 0 zł" + „Pozostało = należne", no
per-worker rows (block not hidden).

**Contract**: Owner-only by construction (subcontractor views unreachable in client view) — links
always active, no plain-text fallback. Polish UI label „Podsumowanie podwykonawców". Tailwind v4
utilities only.

#### 5. Panel branch + toggle gate

**File**: `src/components/kosztorys/kosztorys-totals-panel.tsx`

**Intent**: `priceView === 'client'` → `KosztorysSummary` (unchanged); else → `SubcontractorSummary`.
Hide the netto/brutto toggle control when `priceView !== 'client'`.

**Contract**: Klient view render path is untouched.

### Success Criteria

#### Automated Verification

- Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit`
- Lint passes: `pnpm lint`
- Unit tests pass: `pnpm exec vitest run`
- New unit tests: `executedWorkNetPreRabat` (per-item + global discount → pre-rabat sum);
  `computeSubcontractorSummary` (negative remaining, empty payouts, null bucket ordering, zero
  executed). Run: `pnpm exec vitest run src/lib/kosztorys src/__tests__`
- Tailwind v4 audit clean on `subcontractor-summary.tsx` (no `var(--…)` in `[...]`, no inline colour)

#### Manual Verification

- Toggling to Z narzędziami / Bez narzędzi shows „Podsumowanie podwykonawców"; Klient view unchanged.
- `Suma wykonanej pracy` equals the executed-work value at the active subcontractor price **without**
  rabat; changes with the view toggle and with progress edits.
- Per-worker rows link to that worker's payouts on this investment; the null bucket appears when a
  PAYOUT lacks a worker; razem and pozostało reconcile (`pozostało = należne − razem`, negative shown).
- The netto/brutto toggle does not render in the subcontractor views.

**Implementation Note**: Final phase — after automated verification, `/10x-implement` aggregates the
manual bullets into `context/foundation/manual-checks.md`. The browser-level render is a low-risk
plumbing surface; the E2E is **deferred to the `e2e-backlog`** (Linear issue, label `e2e-backlog`,
project „Wykonczymy") per AGENTS.md rather than authored now.

---

## Testing Strategy

### Unit Tests

- `executedWorkNetPreRabat`: a per-item-rabat row and a global-discount row both yield `Σ(net +
discount)` = the pre-rabat executed value.
- `computeSubcontractorSummary`: negative `remaining` (overpaid), empty payouts (`payoutsTotal = 0`,
  `remaining = dueNet`), null-worker bucket sorts last, zero executed (`dueNet = 0`, `remaining =
−payoutsTotal`).
- `buildTransferFilters` `worker` param: `{ worker: '5' }` → `worker: { equals: 5 }`; absent/invalid → no
  clause.

### Integration Tests

- `sumPayoutsByWorkerForInvestment` (5435 container, self-cleaning): grouping incl. null bucket,
  cancelled excluded, non-PAYOUT excluded, investment-scoped.

### E2E

- Deferred to `e2e-backlog` (Linear, label `e2e-backlog`). Not authored in this slice.

## Performance Considerations

One extra grouped read per kosztorys page load, cached on `CACHE_TAGS.transfers`. PAYOUT count per
investment is bounded (~118 worst case seen); grouping is trivial. Należne reuses subtotals the hook
already computes — no extra pass.

## Migration Notes

None — read-only over existing transfers + kosztorys rows.

## References

- Change identity + owner decisions: `context/changes/podsumowanie-podwykonawcow/change.md`
- Model (EX-551): robocizna = cena klienta, wypłaty = cena podwykonawcy
- Pre-rabat construction: `src/lib/kosztorys/settlement.ts:55-69`
- Query template: `src/lib/db/sum-transfers.ts:112-132`; cache wrapper:
  `src/lib/queries/reference-data.ts:255-265`
- Domain background: `context/reference/kosztorys-editor-domain-notes.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename
> step titles. See `references/progress-format.md`.

### Phase 1: Server figure — PAYOUT per worker × investment

#### Automated

- [x] 1.1 Type checking passes (`pnpm generate:types && pnpm exec tsc --noEmit`)
- [x] 1.2 Lint passes (`pnpm lint`)
- [x] 1.3 Unit tests pass (`pnpm exec vitest run`)
- [x] 1.4 DB-integration test for `sumPayoutsByWorkerForInvestment` (null bucket, cancelled, non-PAYOUT, investment scope) passes

### Phase 2: `worker` URL filter

#### Automated

- [ ] 2.1 Type checking passes (`pnpm generate:types && pnpm exec tsc --noEmit`)
- [ ] 2.2 Lint passes (`pnpm lint`)
- [ ] 2.3 Unit tests pass (`pnpm exec vitest run`)
- [ ] 2.4 Unit test for `buildTransferFilters` `worker` param passes

### Phase 3: `SubcontractorSummary` block + panel branch

#### Automated

- [ ] 3.1 Type checking passes (`pnpm generate:types && pnpm exec tsc --noEmit`)
- [ ] 3.2 Lint passes (`pnpm lint`)
- [ ] 3.3 Unit tests pass (`pnpm exec vitest run`)
- [ ] 3.4 `executedWorkNetPreRabat` + `computeSubcontractorSummary` unit tests pass
- [ ] 3.5 Tailwind v4 audit clean on `subcontractor-summary.tsx`
