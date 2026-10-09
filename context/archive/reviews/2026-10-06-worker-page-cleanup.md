# Review-gate ledger — worker-page-cleanup (spike, no change folder) · 2026-10-06

Scope: `7f105dac..0a4125ca` on `staging` (fabd7682, ec96a030, 0a4125ca). Step 0.5 skipped — the
commits are local, staging can't be verified; the manual checks stay open in
`context/foundation/manual-checks.md` § „2026-10-06 — worker-page-cleanup”.
Checks run: code-review, tailwind-v4-audit (0 findings), feature-first-structure,
module-cohesion-audit, structure-scatter-audit, comment-noise-audit. `/10x-impl-review` dropped (no plan.md).

_Trimmed at archive (2026-10-09): 18 of 33 findings were `fixed` and are removed — their record is the commit. Orphan from `.review-gate/` (no change folder). What remains is what the gate chose not to act on._

## Findings

- [x] 🟡 WARNING · dismissed · code-review · `src/app/(frontend)/pracownicy/[id]/page.tsx` · `showCancelledFilter: false` / `showSearchFilters: false` hit the manager too — user's call 2026-10-06: hidden for both, the worker page is simplified for every viewer
      test: no automated test — intended behaviour, not a bug
- [x] 🔵 OBSERVATION · dropped · code-review · `page.tsx:70-72` · investments in `/kosz` drop out of the facet options — edge UX; a trashed investment's transfers are not something a worker filters for
      test: no automated test — unreachable in practice
- [x] 🔵 OBSERVATION · dropped · code-review · `page.tsx:133-139` · a hidden filter's URL param still narrows the list — only via a hand-made link; „Wyczyść filtry” stays enabled and clears it
      test: no automated test — low reachability
- [x] 🔵 OBSERVATION · skipped · code-review · i18n `myInvestmentsHint` / `expenseDrafts.hint` · first-person hints also render for a manager — same convention as the existing „Moje kasy” / „Moje inwestycje”; the page speaks in the worker's voice by design
      test: no automated test — wording
- [x] 🔵 OBSERVATION · dropped · code-review · `src/components/ui/collapsible-section.tsx:68` · `<h2>` inside the trigger `<button>` — pre-existing on 3 other hosts, renders and hydrates fine
      test: no automated test — no observable failure
- [x] 🔵 OBSERVATION · dropped · code-review · `transfer-data-table.tsx` · closed-by-default transfers section still fetches its page — one paginated page of a worker's rows; lazy-loading would be new mechanics for no measurable cost
      test: no automated test — efficiency
- [x] dropped · code-review · `transfer-data-table.tsx:127` · `storageKey="transfers:section"` not host-scoped — one host; a second one would decide its own key
- [x] dismissed · code-review · `page.tsx:92` · `pb-20 sm:pb-20 lg:pb-20` — `cn` runs tailwind-merge per variant (verified by tailwind-v4-audit); all three needed against PageWrapper's `p-4 sm:p-6 lg:p-8`
- [x] skipped · feature-first-structure · `page.tsx:66-73` · facet → option shaping inline in the route — `kasa/[id]` and `inwestycje/[id]` compose filter config inline too; one host, no second consumer to share a helper
- [x] dismissed · module-cohesion · `summary-grid.tsx`, `sum-transfers.ts`, i18n dictionaries, `transfer-totals.ts` · cohesion candidates — each one concern, verified
- [x] dropped · simplify · `src/components/ui/empty-state.tsx:14` · same title classes — an empty-state title is not a section heading; sharing the token would couple two things that may diverge
- [x] dismissed · simplify · `page.tsx:101` · `pb-20 sm:pb-20 lg:pb-20` with no recorded reason — the user's explicit request this session („dodaj pb … co najmniej pb-20”); no rationale to invent
- [x] dropped · simplify · `src/components/ui/section-header.tsx` / `kosztorys/summary/tabs/summary-overview-tab.tsx:148` · single-consumer `SectionHeader`; small heading hand-built in the summary tab — a `size`/separator API for one more consumer is no win; equipment staying static is a product call, not a cleanup
- [x] dropped · simplify · `sum-transfers.ts:302` · live-rows rule written in SQL and as a `Where` — follows the file's own `sumFilteredByType` idiom
- [x] dismissed · simplify · `listTransferFacets` / `transfer-filters.tsx` / `SUMMARY_NAME_COL` · reuse candidates — not duplicates (verified)

## Simplify pass

Ran /simplify (4 agents: reuse, simplification, efficiency, altitude) — 6 applied, 0 proposed, 5 dropped/dismissed; folded into ## Findings (tagged simplify). Typecheck clean; 20 spec files / 133 tests green.

## Tests & suite

Full suite: skipped by user (typecheck + 20 touched spec files / 133 tests green; pre-push runs the unit + integration legs).
