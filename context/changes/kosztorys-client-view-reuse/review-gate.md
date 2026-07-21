# Review-gate ledger — kosztorys-client-view-reuse (EX-532) · 2026-07-20

Scope: `f7cb31a3..HEAD` (8 commits, ~25 source files, +539/−766).
Step 0.5 verification pass: **deferred by user** (manual browser checks owed separately).

## Findings

<!-- ONE checkbox per finding. Format: [box] [severity, bug-finding only] · disposition · `source` · `file:line` · what — reason -->

- [x] 🔴 CRITICAL · fixed · code-review + impl-review(F1) · `use-kosztorys-editor.ts:117` · `clientView` no longer pinned the price plane to `'client'` — public page ships full tree, so a client could set `localStorage['kosztorys-view:<id>']='w_tools'` and render subcontractor prices via allowlisted price/net/gross columns. Fixed: `view = clientView ? 'client' : persistedView`. Same fix restores preview faithfulness (owner's persisted view no longer bleeds into „Podgląd dla klienta").
      test: e2e — the unit harness is node-env with no jsdom, so the hook can't be rendered (renderHook unsupported; the jsdom hook harness is the deferred EX-515 prerequisite). The regression guard is therefore browser-level: forcing `localStorage['kosztorys-view:<id>']='w_tools'` on `/k/<token>` must still render client prices. **Filed EX-550 (Risk 2)** — the slice's owed E2E, `e2e-backlog`.
- [x] 🟡 WARNING · dismissed (owner ratified 2026-07-20) · impl-review(F1) · `kosztorys-editor-body.tsx:189`, `column-config.ts` COLUMN_LABELS, `header-tips.ts` · slice changed OWNER-visible column labels (verbose „Pomiar (razem etapy)" etc.), header-row height (32→56), and header tips/wrapping — ungated on `clientView`. Owner confirmed intended in BOTH views (disambiguates „względem przedmiaru" vs „względem pomiaru"). Plan's "owner unchanged" contract superseded; addendum recorded in plan.md.
- [x] 🟡 WARNING · fixed · impl-review(F2) + code-review · `header-tips.ts:20-27` · brutto tips (`plannedGross`/`gross`/`remainingGross`) stated the NET formula (missing `× (1 + VAT)`); typos „przemiaru"→„przedmiaru", trailing „pomiar .". Fixed, mirroring the in-file stage-gross `× (1 + VAT)` pattern.
- [x] 🟡 WARNING · fixed · code-review + impl-review(F6) · `column-config.ts:107` · security comment asserted two locks (payload has no coefficients; `toClientView` pins 'client') this diff DELETED — actively misleading. Rewritten to describe the new render-side pin.
- [x] fixed · code-review + impl-review(F6) · `v2-columns-readonly.test.ts:41` · same stale `toClientView` reference in test comment — updated.
- [x] 🔵 OBSERVATION · dropped · code-review(F4) · `client-kosztorys.ts:60` · token path 500s (not 404) if investment deleted after share created. Too minor: throwaway kosztorys data, global-error catches it, needs a deleted-investment-with-live-share edge. Not worth the churn.
- [x] 🔵 OBSERVATION · skipped · impl-review(F5)+code-review · `client/section-pie.tsx`, `types.ts:138` (`ClientSectionShareT`) · orphaned after footer deletion — but plan EXPLICITLY says "do NOT delete section-pie (separate slice)". Plan-sanctioned; leave for the section-pie slice.
- [x] 🔵 OBSERVATION · fixed · impl-review(F3) · `podglad-klienta` route relocated to `(share)` group + auth re-verified (not an IDOR) · recorded in plan as the intended move so the byte-identical-shell rationale is documented.
- [x] fixed · structure-scatter + feature-first · `client/money-axis-toggle.tsx` · was imported by shared `kosztorys-editor-body.tsx` (owner+client) yet filed under `client/`. `git mv`'d to `components/kosztorys/money-axis-toggle.tsx`, import updated.
- [x] fixed · comment-noise · `stage-header.tsx:29` · pure style narration restating removed `truncate` — trimmed.
- [x] fixed · comment-noise · `kosztorys-v2-columns.tsx:129` · trimmed filler tail ("same behavior as every other header…"). `totals-panel.tsx:42` dropped — kept as a minimal prop doc, not worth the churn.
- [x] fixed · simplify(reuse) · `cells/{unit-column,section-name-cell,discount-columns}.tsx` · read-only cell span duplicated 4× with alignment drift → extracted `ReadOnlyCellText` primitive (`cells/read-only-cell-text.tsx`).
- [x] fixed · simplify(reuse) · `client-kosztorys.ts` + `kosztorys-editor-v2.tsx` + `kosztorys-editor-body.tsx` · the 9-field editor-data shape existed 3× → unified into `KosztorysEditorDataT` in `lib/kosztorys/types.ts`; all three consume it. (Dedup touching pre-existing files — in scope.)
- [x] fixed · simplify · `use-kosztorys-editor.ts:256` · `clientView ? undefined : handler` repeated 8× → `ownerOnly()` local helper.
- [x] fixed · simplify(altitude) · `kosztorys-totals-panel.tsx`, `kosztorys-podsumowanie.tsx` · `reconciliation` made optional was dead flexibility (sole callers always pass it) → reverted to required, dropped `?.`/`!!` guards.
- [x] dismissed · simplify(efficiency) · (whole diff) · efficiency clean — new `fetchZaliczkiByStage` added into existing `Promise.all`, client path does _less_ work (onChange early-return). No change owed.
- [x] 🔴 CRITICAL · fixed · verify(manual) · `kosztorys-etap-totals.tsx` + `kosztorys-totals-panel.tsx` · client page leaked an internal `<Link href="/inwestycje/<id>">` via the „Suma transzy" block's „Wpłaty" label — `KosztorysEtapTotals` never received `clientView` (the sibling Podsumowanie already gated it). A client's DOM shipped a clickable owner-only route. Fixed: threaded `clientView`, render „Wpłaty" as plain text when set. Re-verified: 0 anchors on `/k/<token>` + `/podglad-klienta`, owner keeps the link.
      test: e2e — folded into EX-550 (Risk 3: assert zero `a[href]` on the client page). Node-env unit harness can't reach the rendered clientView footer.

## Simplify pass

Ran /simplify (4 cleanup agents: reuse / simplification / efficiency / altitude) — 6 applied, 0 proposed, 1 dismissed (efficiency clean); each folded into ## Findings above (tagged simplify). Efficiency angle flagged the full-editor-hook-per-viewer cost as an accepted, on-record tradeoff (identical-render invariant). typecheck + lint green after.

## Tests & suite

- **E2E obligation (browser-level slice):** filed **EX-550** (`e2e-backlog`, project Wykonczymy). One spec area on the public `/k/<token>` page covering both risks: Risk 1 cookie-less reachability, Risk 2 = the CRITICAL price-plane pin (forced `w_tools` localStorage must still render client prices). Discharges the CRITICAL's test disposition and the slice's owed E2E in one issue.
- **No new unit tests owed:** the CRITICAL's guard is browser-level (node-env harness can't renderHook); the pure-column read-only test (`v2-columns-readonly.test.ts`) already existed and its stale comment was corrected in this diff.
- **Full suite (2026-07-21):** typecheck ✅ · lint ✅ 0 errors (89 pre-existing migration-file warnings) · test ✅ 1082 passed / 47 skipped (DB-integration self-skips, no live DB) · build ✅ (`/k/[token]` + `/podglad-klienta/[id]` compiled). E2E leg deferred to EX-550.
- **Manual verification (Step 0.5, done 2026-07-21):** drove all 8 `kosztorys-client-view-reuse` checks against the test-DB app (5435, inv 7, cookie-less `/k/<token>` + OWNER `/podglad-klienta/7` + `/inwestycje/7/kosztorys_v2`) — **all 8 ticked**. Surfaced + fixed one CRITICAL leak on the spot (Wpłaty `<Link>` in `KosztorysEtapTotals`, see Findings). Registry: `context/foundation/manual-checks.md` → `## kosztorys-client-view-reuse`. Zero open findings.
