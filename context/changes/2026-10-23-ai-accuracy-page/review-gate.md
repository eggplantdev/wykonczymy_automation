# Review-gate ledger — ai-accuracy-page · 2026-10-23

Scope: `8c8bf1062..working tree` — p1 `3bb299fd7`, p2 `8719ece89`, epilogue `5ac065e34` and the
uncommitted recharts redesign of `src/components/investments/ai-accuracy/`.

Step 0.5 (browser pass) skipped: the user checked the page in their own browser („It is working").
Fan-out: code-review, 10x-impl-review, tailwind-v4-audit + comment-noise-audit, structure/cohesion/scatter + primitive-reuse-scan.

## Findings

- [x] 🟡 WARNING · fixed · code-review · `src/lib/kosztorys/ai-accuracy.ts` `rightPercent` · tiles and the method example could go below 0% when errors exceed the kosztorys; only the per-case column was clamped — floor moved into `rightPercent`, the two per-case clamps removed
      test: test-driven-debugging · unit — 'never scores the tiles or the example below 0% either' in `src/__tests__/lib/kosztorys/ai-accuracy.test.ts` (written, not run: user's standing no-tests instruction)
- [x] 🟡 WARNING · fixed · code-review · `accuracy-repeat-tooltip.tsx` · „Ile razy wpisano powód: X z Y” divided a count of corrections by a count of cases (could read „5 z 3”) — now „Poprawki z wpisanym powodem: X”; CSV `reasons_written` unchanged
      test: no automated test · — copy-only change, covered by the manual check
- [x] 🟡 WARNING · fixed · impl-review F3 · `scripts/ai-kosztorys/accuracy-report-prod.ts` · script counted trashed investments the page excludes (`trashed_at IS NULL`) — `select[trashedAt]` + trashed treated as unreviewed
      test: no automated test · — prod-reading one-off script, manual check „ponowne accuracy-report-prod.ts nie zmienia CSV”
- [x] 🔵 OBSERVATION · fixed · code-review · `ai-accuracy-report.tsx` card 1 · title „Większość poprawek nie ma Powodu zmiany” asserted a fact the live data may stop supporting — „Poprawka bez Powodu zmiany niczego AI nie uczy”
      test: no automated test · — copy
- [x] 🔵 OBSERVATION · fixed · code-review · `accuracy-hero.tsx` · „Ostatnie {n} przypadków” wrong plural for n=2–4; delta badge shown as „0 pp” when last window = all cases — „Ostatnie przypadki (n)”, badge hidden when the windows coincide
      test: no automated test · — copy/visibility, manual check
- [x] 🔵 OBSERVATION · dismissed · code-review · `ai-accuracy-chart.tsx` · time axis is investment id, not review order — plan chose id order deliberately (plan.md „Time axis”)
- [x] 🔵 OBSERVATION · dropped · code-review · `ai-accuracy-report.tsx` `reasonSegments` · „Z wpisanym Powodem” segment inferred as 100 − none when a window has zero error — needs a window with 0 zł error; not worth a branch
- [x] 🔵 OBSERVATION · dismissed · code-review · `ai-accuracy.ts` `groupKey` · blank descriptions would collapse into one pozycja — unreachable: 0 of 10 904 reviewed items have a blank description (local DB)
- [x] 🔵 OBSERVATION · dismissed · impl-review F7 · `ai-accuracy.ts` · per-case column is `noReasonPercent`, plan said `noReasonZl` — benign rename to a share, same source figure; table shows a percent by design
- [x] fixed · impl-review F4 · `context/foundation/manual-checks.md` § ai-accuracy-page · checks described the old tiles — rewritten for the hero, plus one box for cards/charts/tooltips/collapsibles/dark mode
- [x] fixed · impl-review F8 · `accuracy-hero.tsx` · hand-built bordered shell — `Panel as="section"`
- [x] fixed · no-hand-rolled-ui · report ×3, method-compare, steps, chart note · raw muted `<p>` — `Description`
- [x] fixed · no-hand-rolled-ui · `accuracy-share-bar.tsx`, `accuracy-hero.tsx` · native `title=` tooltips / `truncate` on stat labels — removed
- [x] fixed · primitive-reuse-scan · `accuracy-hero.tsx`, `accuracy-cause-card.tsx` · hand-rolled eyebrow — `EYEBROW_CLASS`
- [x] fixed · primitive-reuse-scan · `accuracy-method-compare.tsx` · hand-rolled h3 class and fixed green/red tone — `SUBSECTION_TITLE_CLASS`, tone from `accuracyBand(percent)`
- [x] fixed · primitive-reuse-scan · `accuracy-trend-tooltip.tsx`, `accuracy-repeat-tooltip.tsx` · 3rd copy of the chart tooltip shell — `ChartTooltipFrame` extracted in `ui/chart.tsx` (shown in /design via `ChartTooltipContent`)
- [x] fixed · primitive-reuse-scan · `src/lib/queries/ai-accuracy.ts`, `ai-accuracy.ts` groups · hand-rolled grouping (one O(n²) spread) — `groupInOrder`
- [x] fixed · primitive-reuse-scan · `src/lib/db/ai-accuracy-items.ts` · local `num` and `=== null ?` coercions — repo idiom `Number(x ?? 0)` + `numOrNull` / `textOrNull`
- [x] fixed · simplify (reuse) · `src/lib/db/ai-accuracy-items.ts` · hand-built `IN` / empty-list `NOT IN` ternary — `inList`
- [x] skipped · structure C1 / simplify (altitude) · `ai-accuracy.ts` · `scoreCases` returns CSV-shaped snake_case tables that `summarizeAccuracy` zips back by index — review-worthy refactor; the CSV shape is frozen for the committed ai-cases files
- [x] skipped · primitive-reuse-scan R15 / simplify (reuse) · `ai-accuracy.ts` `groupKey` · could use `foldDescription` — changes the repeat counts and breaks parity with the ai-cases CSVs; owner's call
- [x] dismissed · structure F1 · `ai-accuracy/format.ts` · feature formatters outside `lib/` — one consumer directory; promote when a second one reaches for them
- [x] dropped · primitive-reuse-scan R7/R8/R9/F2, simplify (altitude 3/4) · legend swatch / meter / share bar / band `color`+`swatch` · share bar is a stacked bar, the single-value meter has two copies — below the 3rd-copy rule
- [x] dropped · primitive-reuse-scan R10/R13/R14 · stat line, accent text map, Badge size — two copies / cosmetic
- [x] dropped · simplify (altitude 5) · script vs SQL case predicate · REST script and SQL can't share a predicate cheaply; both read the shared stage/exclusion constants
- [x] dropped · gradient text ×2 · two copies
- [x] fixed · comment-noise · `ai-accuracy.ts:1-2`, `ai-accuracy-items.ts:12`, `accuracy-report-prod.ts:1-2`, `scripts/ai-kosztorys/accuracy.ts:1-2`, `investment-ai-stage.ts:74` · narration comments deleted/trimmed (kept `ai-accuracy.ts` regex-stem and window comments)
- [x] fixed · simplify · `ai-accuracy.ts` · `windows.latest` summarized one case the hero reads two fields of — dropped; hero takes `cases.at(-1)`
- [x] fixed · simplify · `ai-accuracy.ts` · window `labels` array built only to be counted; `splitZl` returned but unread — `count`, `splitZl` local
- [x] fixed · simplify · `ai-accuracy.ts` · re-sort of repeat groups already emitted 3→2→1 — removed
- [x] fixed · simplify · `scripts/ai-kosztorys/accuracy.ts` · same case-number mapper twice — `withCase`
- [x] fixed · simplify · `ai-accuracy-report.tsx` · `reasonSegments` closure with no component state — module level
- [x] dropped · simplify · `accuracy-cases-table.tsx` · `accuracyBand` called twice per row — needs a block-bodied flatMap for no gain
- [x] dismissed · simplify · `ai-accuracy-items.ts` · constant-only parameters — `lib/db` takes its filters as arguments by convention
- [x] dismissed · tailwind-v4-audit · 0 findings

## Simplify pass

Ran /simplify (4 agents: reuse, simplification, efficiency, altitude) — 7 applied, 2 skipped (folded into existing C1/R15 lines), 5 dropped/dismissed; efficiency clean. Each finding folded into ## Findings (tagged simplify).

## Tests & suite

Deferred by user (standing instruction: no tests, typecheck, lint or build unless asked). Spec `ai-accuracy.test.ts` edited, not run.
