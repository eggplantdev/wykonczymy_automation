      # Review-gate ledger — investments-listing-no-kosztorys-figures · 2026-10-02

Base: `c937a640` (staging tip at branch point). Checks: 10x-impl-review, code-review, comment-noise-audit (flag-only).
Dropped out: tailwind-v4-audit, feature-first-structure, module-cohesion-audit, structure-scatter-audit — the diff adds no
new module (one spec in its mirrored path) and no new utility classes. Step 0.5 skipped: no browser pass unprompted;
the manual checks sit in `context/foundation/manual-checks.md`.

## Findings

- [x] 🟡 WARNING · fixed · impl-review + code-review · `context/reference/kosztorys-editor-domain-notes.md:1529` · still said the off-tryb bilans reads „nie dotyczy" — now names the tryb
      test: no automated test · — prose doc
- [x] 🔵 OBSERVATION · fixed · impl-review · `AGENTS.md:390` · rule rewrite dropped what flags legacy robocizna — added the Robocizna v2 rozjazd icon clause
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/__tests__/components/tables/investments.test.tsx:120-164` · sort tests asserted one click only — now both directions, withheld „Pozostało" last in each
      test: TDD · unit (dom) — the spec itself is the guard; 6/6 green
- [x] 🔵 OBSERVATION · fixed · impl-review · `context/foundation/investment-financials-and-discount.md:177` · bullet ran past the doc's wrap width — rewrapped
- [x] 🔵 OBSERVATION · fixed · code-review · `src/__tests__/components/tables/investments.test.tsx:32` · fixture had `marginV2: -150` with `totalSettled: 0` — set `totalSettled: 150` so the row is self-consistent
      test: no automated test · — fixture correction, the spec is the test
- [x] dropped · impl-review · `src/components/tables/investments-header-tips.ts` · laborCostsFromKosztorys tip could mention the rozjazd icon — the icon carries its own tooltip
- [x] dropped · code-review · `src/components/tables/investments.tsx:59-62` · `withheldFigureCell` has one caller left — inlining is churn without gain
- [x] dropped · code-review · `src/components/tables/investments.tsx:255` · `getValue()` read before the no-kosztorys early return — one property read
- [x] dropped · code-review · `src/__tests__/components/tables/investments.test.tsx:53` · `columnIndex` duplicated with `users.test.tsx` — two test-local copies, no shared helper home warranted
- [x] dropped · code-review · `src/__tests__/components/tables/investments.test.tsx:53` · `columnIndex` returns −1 silently on a missing header — the cell lookup then fails loudly anyway
- [x] fixed · comment-noise-audit · `src/components/tables/investments.tsx:68-69` · trailing sentence restated what the cell renders — removed
- [x] dismissed · comment-noise-audit · `src/__tests__/components/tables/investments.test.tsx:21` · „Kijowska shape" comment — names the real case the fixture models; fails the strip test
- [x] dropped · simplify · `src/components/tables/investments.tsx:41-49` · gate-removal rationale sits on the `NoKosztorys` leaf — moving it buys nothing
- [x] dropped · simplify · `src/__tests__/components/tables/investments.test.tsx:53-57` · `columnIndex` re-scans headers per lookup — ~8 lookups on a 4-row table
- [x] dismissed · simplify · `src/components/tables/investments.tsx:255` · „Pozostało" withhold reason as a discriminated field — would touch shaper, type, sort and tests to save two lines

## Simplify pass

Ran /simplify — 0 applied, 0 proposed, 1 dismissed; each finding folded into ## Findings (tagged simplify).
Report: `/var/folders/cf/bs0zn0gj1lgbc2n7ps0z211h0000gn/T/simplify-XXXXXX.IHA6QGNSj8.md`

## Tests & suite

- `pnpm exec vitest run src/__tests__/components/tables/investments.test.tsx` — 6/6 green
- `pnpm exec vitest run src/__tests__/lib/queries/shape-investments.test.ts` — 30/30 green
- typecheck + lint — green
- E2E — not owed: render-only change on one table, no server action / DB / revalidation crossed; the DOM spec covers it
- Full suite — skipped by user (render-only change; pre-push runs the unit leg)
