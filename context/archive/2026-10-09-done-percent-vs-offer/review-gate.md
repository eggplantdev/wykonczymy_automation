# Review-gate ledger — done-percent-vs-offer · 2026-10-09

Scope: working tree vs `HEAD` (e0826b910) on `spike/transfer-cards`, restricted to this slice's 24 files + 2 new migrations — nothing of the slice is committed yet, and the tree carries other sessions' work.

Step 0.5 (browser verification) skipped — the Playwright MCP is not driven unless asked in that turn. Manual checks live in `context/foundation/manual-checks.md` § `2026-10-09 — done-percent-vs-offer`.

Checks run: `10x-impl-review`, `code-review`, `comment-noise-audit` (flag-only), file organization (`feature-first-structure` + `module-cohesion-audit` + `structure-scatter-audit`, diff-scoped). Dropped: `tailwind-v4-audit` (no `className` in the diff).

## Findings

- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/lib/kosztorys/worker-view/settings.ts` · global `defaultValue []` would show both new columns on an environment with no settings row — unreachable: every environment is a prod dump carrying the row; pre-existing shape
      test: no automated test — unreachable path
- [x] dismissed · impl-review · `src/lib/kosztorys/settlement-columns.ts` · the percentage hides until the first etap entry — intended, same rule as „Wartość wykonana"
- [x] dismissed · impl-review · `src/lib/i18n/dictionaries/pl.ts` · tip deviates from the plan — recorded in `change.md` (later folded, see the simplify line below)
- [x] dismissed · impl-review · plan drift on spec names — the specs cover the plan's risks under their existing files
- [x] dismissed · impl-review · investor document order of the new column — follows `CLIENT_VIEW_GROUPS`, as planned
- [x] dismissed · comment-noise-audit · `src/__tests__/lib/kosztorys/columns/column-values.test.ts:96` · carries the why (worker surface reads all etapy)
- [x] filed · simplify (altitude) · `src/migrations/20261009_*` · each hidden-by-default document column costs a migration, a deploy-order rule and a leak window, because the stored value is the hidden set — a sparse `key → hidden` map read against the code default removes all three; a stored-contract change, out of scope here — filed EX-1033
- [x] dropped · simplify (altitude) · `src/__tests__/components/kosztorys/editor/grid/column-value-parity.test.ts:120` · exclusion list grows with each all-etapy column — the worker grid has no sort, so the parity is moot there; reworking the fixture buys nothing
- [x] dropped · simplify · `src/lib/kosztorys/header-tips.ts:41` · editor tip for the percentage repeats two lines of `pl.grid.tipPlannedDonePercent` — the first lines and the `CLIENT_BASE` tail genuinely differ; a shared fragment would be worse
- [x] dropped · simplify · `src/lib/kosztorys/columns/column-values.ts:108` · `executedQtyByItem[row.id] ?? 0` twice — a helper over two call sites gains nothing
- [x] dismissed · reuse-scan · UI diff (`kosztorys-v2-columns.tsx`, worker-view dialog) · one `resolvedColumn(…, formatPercent)` line and one text change — nothing reinvented

## Simplify pass

Ran `/simplify` (reuse, simplification, efficiency, altitude) + `primitive-reuse-scan` — 4 applied, 1 filed (EX-1033), 3 dropped; each folded into ## Findings (tagged `simplify` / `reuse-scan`).

## Tests & suite

Not run — the test hook blocks typecheck / specs until the user asks („odpal testy”). Owed: typecheck + the 10 touched specs (`column-values`, `settlement-columns`, `kosztorys-layer`, `kosztorys-money-axis`, `column-value-parity`, `client-view/settings`, `print/offer`, `print/worker`, `worker-view/columns`, `worker-view/settings`).
