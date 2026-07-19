# Plan — Stream the „z kosztorysu" recon block (EX-542)

Fully shaped in EX-540's options-analysis comment; this is the compact execution plan.

## Phase 1 — extract + stream

### Changes Required

1. **New `src/components/investments/investment-recon-block.tsx`** — async **server** component
   `InvestmentReconBlock({ investmentId, investmentRobocizna, investmentRabat })`. Fetches only
   `getKosztorysTree`, computes `treeToRows` → `kosztorysClientTotals` → `buildKosztorysReconciliation`
   (same path as before), renders the „z kosztorysu (netto)" block, or `null` when the investment has
   no kosztorys rows. The block's tooltip children (`ReconMismatchBadge`, `InfoTooltip`) are client
   components rendered from the server component — no `'use client'` needed here.

2. **New `src/components/investments/investment-recon-block-skeleton.tsx`** — neutral Suspense
   fallback. Same heading + two placeholder rows; NO „zgodne"/green cue (must not flash reassurance
   before the scream resolves). Uses `GradientSpinner`.

3. **`financial-stats.tsx`** — drop the `reconciliation` data prop and its render block (+ the
   now-unused `RECON_LINES`, `TOOLTIPS.zKosztorysu`, and `ReconMismatchBadge` / `reconciliationTooltip`
   / `Separator` / `cn` / `KosztorysReconciliationT` imports). Add `recon?: ReactNode` slot, rendered
   where the block was.

4. **`inwestycje/[id]/page.tsx`** — drop `getKosztorysTree` from the `Promise.all` and the
   reconciliation computation; import `Suspense`, `InvestmentReconBlock`, the skeleton; pass
   `recon={<Suspense fallback={<skeleton/>}><InvestmentReconBlock .../></Suspense>}`. Feed the cheap
   `financials.totalLaborCosts` / `totalRabat` as props (no transaction re-fetch).

### Success Criteria

- `getKosztorysTree` no longer on the page's critical path; page shell + `FinancialStats` (cheap
  fields) + transfers render without awaiting the tree.
- The „z kosztorysu" block streams in and still routes through `kosztorysClientTotals` (single source
  intact — investment page and editor Podsumowanie can't drift; EX-535 Phase-4 parity E2E unaffected).
- `pnpm typecheck` + `pnpm lint` (touched files) + `pnpm test` clean.

### Out of scope

- The wasted I/O for kosztorys-less investments (stays on EX-540).
- Caching the derivation (EX-540 option B, measurement-gated).

## Progress

### Phase 1

- [x] 1.1 InvestmentReconBlock server component
- [x] 1.2 Neutral skeleton fallback
- [x] 1.3 FinancialStats recon slot
- [x] 1.4 Wire Suspense in page.tsx
- [x] 1.5 typecheck + lint + test
