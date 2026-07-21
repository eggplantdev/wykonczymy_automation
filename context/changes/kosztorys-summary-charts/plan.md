# Kosztorys Podsumowanie — two pie charts (section split + cost split) Implementation Plan

## Overview

Add two pie charts to the kosztorys „Podsumowanie" footer, beside the summary table: a **section
split** (each section's share of the offer, with a live Przedmiar ↔ Wykonane base toggle) and a
**cost split** (robocizna + per-category materiały). Both use recharts, are dynamically loaded so
the library never enters the editor's main chunk, and take colour by index from the existing
`--color-chart-*` palette. This ships EX-529 (section pie) plus its natural sibling; per-section
colour storage + a colour picker is a deliberately separate follow-up slice.

## Current State Analysis

- The footer is `KosztorysTotalsPanel` → `KosztorysPodsumowanie` (summary table) + `KosztorysEtapTotals`,
  mounted in `kosztorys-editor-body.tsx:199`. It renders in **both** the editor and the client-share
  view (`(share)/podglad-klienta/[id]` and `(share)/k/[token]` both mount `KosztorysEditorBody clientView`).
- **Section data already exists.** `sectionSubtotalsForView` (`settlement.ts:167`) carries per section:
  `plannedNet` (offer / Przedmiar), `net` (executed / Wykonane at the active view), and `share`
  (executed split, client-priced, view-invariant). The editor holds two memos: the view-aware
  `subtotals` (`use-kosztorys-editor.ts:305`) and a **client-priced** `sectionSubtotalsForView(rows,
stages, 'client')` (`use-kosztorys-editor.ts:347`). Neither is passed to the footer today.
- **Cost data already arrives at the footer.** `KosztorysTotalsPanel` / `KosztorysPodsumowanie`
  already receive `materialyBreakdown` (per-category, Σ === `materialyNet`) and robocizna
  (`doZaplatyNet` / `sumaPracNet`). The cost pie mirrors rows the summary table already lists.
- **No charting library** is installed. recharts + a shadcn `ui/chart.tsx` wrapper existed and were
  removed as dead code (`d00e3380`); this is a re-add. Last version was `recharts@^2.15.4`; the
  wrapper recovers from `d5087146` and imports the now-moved `@/lib/cn`.
- A hand-rolled conic-gradient pie exists at `client/section-pie.tsx` — never mounted, superseded by
  this work, to be deleted.
- The base question (offer vs executed) was the open owner-decision EX-537; resolved via the toggle.

## Desired End State

Opening the Podsumowanie panel (editor or client view) shows the summary table with two pie charts
to its right: **Udział sekcji** (default base Przedmiar, a toggle flips it to Wykonane, legend names
the active base) and **Struktura kosztów** (robocizna + materiały categories). Colours are stable by
index. recharts loads only when the panel renders, not in the editor's initial bundle. Verify: the
section pie's slices sum to 100% and match the section panel's per-section values at the client price;
the cost pie's slices match the summary table's rows; toggling the base re-partitions the section pie
without moving any money figure; `next build` shows recharts in a separate async chunk.

### Key Discoveries:

- Client-priced, view-invariant source for the section pie already exists: `use-kosztorys-editor.ts:347`.
  Use it, **not** the view-aware `subtotals` — a structure chart must not move with the widok cen
  (same reasoning `share`/`completionRatio` already follow, `settlement.ts:173-176`).
- The section pie's default base is `plannedNet` (Przedmiar), settled against the canonical sheet in
  `change.md` — `share`/`net` is the _executed_ split and is the toggle's other position, not the default.
- `materialyBreakdown` rows carry `net` and a nullable `id`/`label`; `KosztorysPodsumowanie` already
  filters `net !== 0` and grosses nothing (materiały is face-value). The cost pie reuses that filter.
- Tailwind cannot scan `bg-chart-${name}`; the existing `SLICE_COLORS` in `section-pie.tsx` pairs the
  raw CSS var (for the fill) with the literal utility (for a swatch) — recharts needs only the var, so
  a plain ordered array of `var(--color-chart-*)` strings suffices.

## What We're NOT Doing

- **No per-section colour storage and no colour picker** — that is the follow-up slice (needs a
  migration adding a section `color`). Here, colour is purely positional.
- No schema/migration, no new server data path — render-only over data that already reaches the footer.
- No change to the section panel's existing tooltip line, to the reconciliation scream, or to the
  price-view logic.
- No cost-pie toggle — the cost split is always executed (matching sheet r463).
- No re-derivation of figures — pies read the same numbers the table/section panel already compute.

## Implementation Approach

Restore the charting stack first (isolated, verifiable by build). Then build the two pie components
as pure presentational pieces over slice arrays, with a tiny pure `*-slices` transform that is the
unit-tested seam. Finally thread the client-priced section subtotals from the editor into the footer,
mount both pies beside the summary table via `next/dynamic`, and delete the dead conic pie.

## Critical Implementation Details

**View invariance.** The section pie must be fed from the client-priced subtotals memo
(`use-kosztorys-editor.ts:347`), never the view-aware `subtotals`. Thread that array (or a derived
slice list) to the footer as a new prop — do not recompute at the active view.

**Dynamic import boundary.** recharts is client-only; import both pies with
`next/dynamic(..., { ssr: false })` from within the (already client) Podsumowanie so the library
lands in an async chunk. A bare static import would pull recharts into the editor's main bundle and
defeat the whole reason recharts is acceptable here.

## Phase 1: Restore the charting stack

### Overview

Re-add recharts and the shadcn chart wrapper so the pies have something to render with, without
touching any kosztorys code yet.

### Changes Required:

#### 1. Dependency

**File**: `package.json`

**Intent**: Add recharts back as a dependency. Hand-edit rather than `pnpm add` (the lightningcss/arm64
gotcha in AGENTS.md → Dependencies), then `pnpm install --force` and `rm -rf .next` if the CSS build
complains.

**Contract**: `"recharts": "^2.15.4"` in `dependencies` (matches the wrapper being restored).

#### 2. shadcn chart wrapper

**File**: `src/components/ui/chart.tsx` (restored)

**Intent**: Recover the removed shadcn recharts wrapper as the charts' container/legend/tooltip
primitives, adjusted for one moved import.

**Contract**: Restore from `git show d5087146:src/components/ui/chart.tsx`; change its `@/lib/cn`
import to `@/lib/utils/cn` (the current home). Exports `ChartContainer`, `ChartTooltip`,
`ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit`
- Linting passes: `pnpm lint`
- Production build succeeds: `pnpm build`

#### Manual Verification:

- `pnpm dev` starts and the editor renders unchanged (no visual/behaviour delta yet).
- No lightningcss/Tailwind CSS build error after the install (the arm64 trap).

---

## Phase 2: Build the two pie components

### Overview

Two presentational recharts pies plus a pure slice-derivation seam. No mounting yet — build and
unit-test in isolation.

### Changes Required:

#### 1. Chart palette + slice transforms

**File**: `src/lib/kosztorys/chart-slices.ts` (new)

**Intent**: One home for the ordered `--color-chart-*` fill list and the two pure functions that turn
footer data into `{ name, value, fill }[]` slices — the unit-tested seam so the pies stay dumb.

**Contract**: `CHART_FILLS: readonly string[]` (the nine `var(--color-chart-*)` strings, order
preserved from the old `SLICE_COLORS`). `sectionPieSlices(subtotals, base: 'przedmiar' | 'wykonane')`
selecting `plannedNet` vs `net` per section. `costPieSlices(sumaPracNet, materialyBreakdown)` →
robocizna slice + one slice per `net !== 0` materiały category. Both assign `fill` by index modulo
`CHART_FILLS.length`.

#### 2. Section pie

**File**: `src/components/kosztorys/section-share-pie.tsx` (new; old `client/section-pie.tsx` deleted in Phase 3)

**Intent**: recharts pie of section slices with a local Przedmiar ↔ Wykonane toggle (default
Przedmiar) and a legend whose heading names the active base.

**Contract**: Props `{ subtotals: ClientSectionShareLikeT }` (the client-priced per-section array
carrying `plannedNet` + `net` + `sectionName` + `sectionId`). Local `useState` base, default
`'przedmiar'`. Renders a segmented Przedmiar/Wykonane control, a recharts `Pie` over
`sectionPieSlices(...)`, and a legend labelled „Udział sekcji — przedmiar" / „— wykonane". Values
formatted with `formatNet` / `formatPercent`.

#### 3. Cost pie

**File**: `src/components/kosztorys/cost-structure-pie.tsx` (new)

**Intent**: recharts pie of the cost split (robocizna + materiały categories), no toggle.

**Contract**: Props `{ sumaPracNet: number; materialyBreakdown: MaterialyBreakdownRowT[] }`. Renders
a recharts `Pie` over `costPieSlices(...)` + legend „Struktura kosztów". Executed base only.

#### 4. Slice-transform unit tests

**File**: `src/__tests__/kosztorys-chart-slices.test.ts` (new)

**Intent**: Lock the seam: base selection and colour assignment are the only logic worth guarding.

**Contract**: `sectionPieSlices` returns `plannedNet` values under `'przedmiar'` and `net` under
`'wykonane'`; slice count === section count; fills cycle by index. `costPieSlices` emits a robocizna
slice + one per non-zero materiały category and drops `net === 0` rows.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `pnpm exec vitest run src/__tests__/kosztorys-chart-slices.test.ts`
- Type checking passes: `pnpm exec tsc --noEmit`
- Linting passes: `pnpm lint`

#### Manual Verification:

- (Deferred to Phase 3 — components aren't mounted yet.)

---

## Phase 3: Mount both pies in the footer

### Overview

Thread the client-priced section subtotals into the footer, render both pies side-by-side beside the
summary table via `next/dynamic`, and delete the dead conic pie.

### Changes Required:

#### 1. Thread section subtotals to the footer

**File**: `src/components/kosztorys/kosztorys-editor-body.tsx`, `kosztorys-totals-panel.tsx`,
`kosztorys-podsumowanie.tsx`

**Intent**: Pass the existing client-priced per-section array (`use-kosztorys-editor.ts:347`) down to
`KosztorysPodsumowanie` so the section pie has its view-invariant source. New prop threaded through
the panel unchanged.

**Contract**: Add a `sectionSubtotals` prop (client-priced array) to `KosztorysTotalsPanel` and
`KosztorysPodsumowanie`; wire it from the editor's existing memo. No recompute.

#### 2. Render the pies beside the summary table

**File**: `src/components/kosztorys/kosztorys-podsumowanie.tsx`

**Intent**: Place the two pies in a row to the right of the summary table (wraps below on narrow
widths), dynamically imported so recharts stays out of the main chunk.

**Contract**: `next/dynamic(() => import('.../section-share-pie'), { ssr: false })` and the same for
the cost pie. Wrap the existing table + the pie row in a flex container (`flex-wrap`, table first).
Feed the section pie `sectionSubtotals`, the cost pie `sumaPracNet` + `materialyBreakdown` (both
already in scope here).

#### 3. Delete the dead conic pie

**File**: `src/components/kosztorys/client/section-pie.tsx` (removed)

**Intent**: Remove the never-mounted hand-rolled pie it supersedes.

**Contract**: File deleted; confirm no imports reference it (`grep -rn section-pie src`).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm exec tsc --noEmit`
- Linting passes: `pnpm lint`
- Unit tests pass: `pnpm exec vitest run src/__tests__/kosztorys-chart-slices.test.ts`
- Production build succeeds and recharts is a separate async chunk: `pnpm build`
- No dead reference remains: `grep -rn "client/section-pie" src` returns nothing

#### Manual Verification:

- Editor Podsumowanie shows both pies beside the table; section slices match the section panel's
  per-section values and sum to 100% at the client price.
- Toggling Przedmiar ↔ Wykonane re-partitions the section pie and updates its legend label; no money
  figure in the table moves.
- Cost pie slices match the summary table's robocizna + materiały rows.
- Client-share view (`/k/<token>`) shows the same pies with no owner-only leakage (no internal links,
  no mismatch scream).
- Colours are stable and legible; the panel still shows „Do zapłaty" when collapsed.
- On a fresh offer (executed = 0) the section pie still renders under the default Przedmiar base.

**Implementation Note**: After Phase 3's automated verification passes, pause for manual confirmation
before archiving.

---

## Testing Strategy

### Unit Tests:

- `chart-slices.ts`: base selection (przedmiar → `plannedNet`, wykonane → `net`), slice counts,
  colour cycling, materiały `net === 0` drop.

### Manual Testing Steps:

1. Open the editor Podsumowanie; confirm both pies render beside the table.
2. Cross-check section slice %s against the section panel's „Udział w całości kosztorysu" values.
3. Toggle the base; confirm re-partition + legend label change, no money movement.
4. Cross-check cost slices against the summary table rows.
5. Open `/k/<token>`; confirm parity and no owner-only elements.

## Performance Considerations

recharts is dynamically imported (`ssr: false`) so it stays out of the editor's initial bundle and
loads only when the panel renders. The pies read already-computed arrays — no extra queries or
derivations on the hot path.

## Migration Notes

None — no schema change. Per-section colour storage (the only DB work this feature could imply) is
explicitly the follow-up slice.

## References

- Design (settled): `context/changes/kosztorys-summary-charts/change.md` → "Design — settled 2026-07-21"
- Section subtotals source: `src/lib/kosztorys/settlement.ts:167`, client-priced memo
  `src/components/kosztorys/use-kosztorys-editor.ts:347`
- Footer: `src/components/kosztorys/kosztorys-podsumowanie.tsx`, `kosztorys-totals-panel.tsx`
- Old stack to recover: `git show d5087146:src/components/ui/chart.tsx`; `git show d8eeb383^:src/components/reports/report-charts.tsx`
- Palette: `src/styles/globals.css:79-88`
- Resolved owner-decision: EX-537

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Restore the charting stack

#### Automated

- [x] 1.1 Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit` — 4a7d6a43
- [x] 1.2 Linting passes: `pnpm lint` — 4a7d6a43
- [x] 1.3 Production build succeeds: `pnpm build` — 4a7d6a43

### Phase 2: Build the two pie components

#### Automated

- [x] 2.1 Unit tests pass: `pnpm exec vitest run src/__tests__/kosztorys-chart-slices.test.ts` — ae713aa6
- [x] 2.2 Type checking passes: `pnpm exec tsc --noEmit` — ae713aa6
- [x] 2.3 Linting passes: `pnpm lint` — ae713aa6

### Phase 3: Mount both pies in the footer

#### Automated

- [x] 3.1 Type checking passes: `pnpm exec tsc --noEmit`
- [x] 3.2 Linting passes: `pnpm lint`
- [x] 3.3 Unit tests pass: `pnpm exec vitest run src/__tests__/kosztorys-chart-slices.test.ts`
- [x] 3.4 Production build succeeds; recharts in a separate async chunk: `pnpm build`
- [x] 3.5 No dead reference remains: `grep -rn "client/section-pie" src` returns nothing
