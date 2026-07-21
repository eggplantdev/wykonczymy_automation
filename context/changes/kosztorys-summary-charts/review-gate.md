# Review-gate ledger — kosztorys-summary-charts (EX-529) · 2026-07-21

Base: `554f477` (merge-base with `konradantonik/ex-532-kosztorys-client-view-reuse`).
Slice commits: `4a7d6a43` (p1) · `ae713aa6` (p2) · `202397e9` (p3) · `bd3279a7` (epilogue).

Source files under review (docs + `pnpm-lock.yaml` excluded):

- `src/lib/kosztorys/chart-slices.ts` (new — the unit-tested seam)
- `src/lib/kosztorys/types.ts` (removed dead `ClientSectionShareT`)
- `src/components/kosztorys/section-share-pie.tsx` (new)
- `src/components/kosztorys/cost-structure-pie.tsx` (new)
- `src/components/kosztorys/pie-legend.tsx` (new)
- `src/components/kosztorys/kosztorys-podsumowanie.tsx` (mount + layout)
- `src/components/kosztorys/kosztorys-totals-panel.tsx` (prop thread)
- `src/components/kosztorys/kosztorys-editor-body.tsx` (prop thread)
- `src/components/kosztorys/use-kosztorys-editor.ts` (expose `progressSubtotals`)
- `src/components/ui/chart.tsx` (restored shadcn wrapper)
- `src/__tests__/kosztorys-chart-slices.test.ts` (new)
- `src/components/kosztorys/client/section-pie.tsx` (deleted — dead conic pie)
- `package.json` (recharts re-add)

## Findings

- [x] 🟡 WARNING · fixed · `code-review`+`impl-review` · `section-share-pie.tsx:52`, `cost-structure-pie.tsx:28`, `pie-legend.tsx:11`, `chart.tsx:57` · React keys derived from free-typed `slice.name` — two sections named "Łazienka" (or a rename collision) produce duplicate keys → dropped/mis-reconciled slices on the base toggle. **Fixed:** added a stable `id` to `PieSliceT` (`section-<id>` / `materialy-<id>` / `korekta` / `robocizna`), key all render sites by it; tooltip keyed by index.
      test: TDD · unit — `kosztorys-chart-slices.test.ts` two new cases: colliding section names → distinct ids; cost slices → unique ids incl. korekta bucket. 9/9 green.
- [x] 🔵 OBSERVATION · dismissed · `code-review`+`verify` · `chart-slices.ts:45` (`costPieSlices`) · A negative `CORRECTION`/korekta net flows unguarded into the cost pie → negative-% legend row (no visible reversed arc at −300,00). **Dismissed (owner ruling 2026-07-21):** negative korekta is a **legacy artifact blocked in new investments** — it exists only on archived investments (~1% of data, e.g. inv 31), so no current flow can produce it. Leaving it as-is keeps pie↔table parity (the correct behavior); dropping the credit would break parity for no live benefit.
      test: no automated test — the behavior is intentional and only reachable on frozen archive data no new flow writes; a guard would pin a dead edge.
- [x] 🔵 OBSERVATION · fixed · `impl-review`(F3)+`file-org` · `chart.tsx:75-100,104` · `ChartLegend`/`ChartLegendContent` exported but zero consumers (both pies use the custom `PieSliceLegend`). **Fixed:** trimmed the two dead exports + `ChartLegendContent` body from the vendored wrapper.
- [x] fixed · `tailwind-v4` · `chart.tsx:59,94` · swatch used arbitrary `rounded-[2px]` where the repo token `rounded-xs` (=2px) exists and `pie-legend.tsx` already uses it. **Fixed:** `rounded-[2px]` → `rounded-xs` (the surviving tooltip swatch; the legend swatch was removed with the dead export).
- [x] fixed · `comment-noise` · `chart.tsx:8,31,73,102` · 4 decorative `// ── Section ──` banners restate the symbol below (STRIP TEST). **Fixed:** deleted (whole `ui/chart.tsx` rewritten leaner).
- [x] 🔵 OBSERVATION · dismissed · `impl-review`(F2) · `chart.tsx` · Landed file is a leaner bespoke wrapper, not the verbatim `d5087146` restore the plan named. **Dismissed:** benign improvement — all required exports present (minus the two dead ones now trimmed), typechecks, adds the `valueFormatter` prop the pies use. Divergence from the literal "restore" wording only.
- [x] 🔵 OBSERVATION · dismissed · `impl-review`(F4)+`file-org` · `pie-legend.tsx` (new, unplanned) · Not in Phase 2's named files. **Dismissed:** sound rule-of-two dedup (both pies render the identical legend); correctly placed in `components/kosztorys/` (feature-specific). Healthy, not scope creep.
- [x] dismissed · `comment-noise` · `use-kosztorys-editor.ts:1064` · `// subtotals + section panel` grouping marker restates the fields. **Dismissed:** pre-existing (not authored by this diff), sits in a changed hunk only incidentally — out of scope for this slice.
- [x] dismissed · `comment-noise` · triplicated `// Client-priced, view-invariant …` on the 3 prop-thread sites · **Dismissed:** each documents its own `PropsT`/return field; the view-invariance invariant is the load-bearing _why_ this figure (not `subtotals`) feeds the pie. Per-prop doc is defensible.
- [x] fixed · `simplify` · `slice-pie.tsx` (new) · `section-share-pie.tsx` + `cost-structure-pie.tsx` rendered a byte-identical `<figure>`/`ChartContainer`/`PieChart`/`Cell.map`/`ChartTooltip`/`PieSliceLegend` block, differing only in `<figcaption>` and slice source — flagged independently by the simplification **and** altitude agents. **Fixed:** extracted a shared presentational `SlicePie({ caption, slices })`; both callers now pass only their caption + slice set, dropping their recharts/`ChartContainer`/`formatNet` imports. The two pies stay visually identical by construction.
- [x] fixed · `simplify` · `section-share-pie.tsx:30` · redundant `base === 'przedmiar' ? 'przedmiar' : 'wykonane'` restated the union value. **Fixed:** collapsed to `{base}` (the `SectionPieBaseT` values already read `przedmiar`/`wykonane`).
- [x] dropped · `simplify` · `chart-slices.ts:48` (`costPieSlices`) · multi-pass build of the cost slice array (robocizna unshift + materiały map). **Dropped:** simplification + efficiency agents both judged it clear as-is; folding the passes would trade readability for nothing measurable.
- [x] dropped · `simplify` · `chart.tsx:24` · `ResponsiveContainer` over a fixed-size container. **Dropped:** shared vendored-wrapper infra, micro, out of this slice's altitude.

## Simplify pass

Ran /simplify — 2 applied (shared `SlicePie` extraction; caption ternary → `{base}`), 0 proposed, 2 dropped (cost-slice multi-pass build; ResponsiveContainer nit). Reuse + efficiency angles came back clean. All findings folded into `## Findings` (tagged `simplify`). No separate report file — folded inline.

## Tests & suite

- **Unit** (`kosztorys-chart-slices.test.ts`): 9/9 green after the React-key `id` fix + the two regression cases; re-run green after the `SlicePie` extraction (field-projected assertions unaffected). `tsc --noEmit` clean.
- **Manual verification** (agent `ab22db8f`, OWNER vs 5435 `db-test`, seeds inv 6/7/31): 8/9 boxes ticked in `manual-checks.md` › `## EX-529`. View-invariance confirmed (section pie held at 86 984,25 across the widok-cen toggle while summary re-priced); cost/section pies cross-checked byte-for-byte vs summary rows; client-share `/k/<token>` parity + zero link-leak + no console errors. 1 open box (negative-korekta owner decision).
- **Full suite** (`typecheck/lint/test/test:e2e/build`): NOT yet run — awaiting user go (and the e2e leg needs the 5435 DB, now free). No behavior-coupled specs owed beyond the existing unit file for this UI slice.

## Notes

- **Gate order flipped this run** (lock contention): the sibling ex-532 pass held the shared
  5435 `db-test` lock, so the review fan-out + `/simplify` (read-only / local) ran first and the
  verification pass ran once the lock freed. Both are now complete.
- **Slice status: all findings closed** (owner dismissed the last open box, 2026-07-21). Remaining
  before archive/`Done`: full suite green + commit. All render/layout/parity/view-invariance gates
  pass and every manual-check box is ticked.
- **Branch/worktree separation from ex-532 deferred** (user directive): no rebasing; handled after
  ex-532 merges to staging.
