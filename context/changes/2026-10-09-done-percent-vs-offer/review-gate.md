# Review-gate ledger — done-percent-vs-offer · 2026-10-09

Scope: working tree vs `HEAD` (e0826b910) on `spike/transfer-cards`, restricted to this slice's 24 files + 2 new migrations — nothing of the slice is committed yet, and the tree carries other sessions' work.

Step 0.5 (browser verification) skipped — the Playwright MCP is not driven unless asked in that turn. Manual checks live in `context/foundation/manual-checks.md` § `2026-10-09 — done-percent-vs-offer`.

Checks run: `10x-impl-review`, `code-review`, `comment-noise-audit` (flag-only), file organization (`feature-first-structure` + `module-cohesion-audit` + `structure-scatter-audit`, diff-scoped). Dropped: `tailwind-v4-audit` (no `className` in the diff).

## Findings

- [x] 🟡 WARNING · fixed · code-review · `src/__tests__/components/kosztorys/editor/grid/column-value-parity.test.ts` · the worker-surface parity case compared `plannedDonePercent` against a sort that is never handed `executedQtyByItem` — filtered out beside `remainingForPlane`
      test: no new test — the parity spec itself is the guard, its filter updated · unit
- [x] 🟡 WARNING · fixed · impl-review · `src/migrations/20261009_2_worker_view_offer_columns_hidden.ts` · migrating before the deploy hides the Aktualizacja on every worker link (old code reads a stored `plannedQty` as its legacy name) — order fixed to „straight after the deploy", one batch with `_1`, runbook in `change.md`
      test: no automated test — a deploy-time ordering, not code behaviour
- [x] 🔵 OBSERVATION · fixed · code-review · `src/migrations/20261009_2_worker_view_offer_columns_hidden.ts` · the legacy-key rewrite opened its own window and rewrote nothing — prod dump 2026-10-09 carries no legacy key; rewrite removed
      test: no automated test — removed code
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/migrations/20261009_1_client_view_planned_done_percent_hidden.ts` · comment claimed it may run before the deploy, contradicting the batch with `_2` — reworded
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/lib/kosztorys/worker-view/settings.ts` · global `defaultValue []` would show both new columns on an environment with no settings row — unreachable: every environment is a prod dump carrying the row; pre-existing shape
      test: no automated test — unreachable path
- [x] dismissed · impl-review · `src/lib/kosztorys/settlement-columns.ts` · the percentage hides until the first etap entry — intended, same rule as „Wartość wykonana"
- [x] dismissed · impl-review · `src/lib/i18n/dictionaries/pl.ts` · tip deviates from the plan — recorded in `change.md` (later folded, see the simplify line below)
- [x] dismissed · impl-review · plan drift on spec names — the specs cover the plan's risks under their existing files
- [x] dismissed · impl-review · investor document order of the new column — follows `CLIENT_VIEW_GROUPS`, as planned
- [x] fixed · structure-scatter-audit / code-review · `src/lib/kosztorys/print/columns.ts` · the offer and worker prints each hand-built a `qtyColumn(… formatPercent …)` — one `computedPercentColumn` beside `computedMoneyColumn` / `computedQtyColumn`
- [x] fixed · code-review · `src/components/kosztorys/editor/dialogs/view-settings/kosztorys-worker-view-dialog.tsx` · the Description listing settlement columns omitted the new percentage
- [x] fixed · code-review · `src/lib/kosztorys/header-tips.ts`, `pl/uk/ru.ts` · tooltip said „Puste" where the cell renders „—" — now „Kreska" / „Прочерк"
- [x] fixed · comment-noise-audit · `src/lib/kosztorys/calc.ts` · `rowOfferDoneFraction` doc trimmed to the why
- [x] fixed · comment-noise-audit · `src/lib/kosztorys/columns/column-values.ts` · ctx comment restored to its original single line
- [x] fixed · comment-noise-audit · `src/lib/kosztorys/worker-view/settings.ts` · „Shown to the crew only when…" restated the code — deleted
- [x] fixed · comment-noise-audit · `src/__tests__/lib/kosztorys/client-view/settings.test.ts` · restating comment deleted
- [x] fixed · comment-noise-audit · `src/__tests__/lib/kosztorys/worker-view/settings.test.ts` · legacy-mapping comment deleted, the offer rationale trimmed
- [x] fixed · comment-noise-audit · `src/__tests__/lib/kosztorys/columns/column-values.test.ts` · restating comment deleted
- [x] dismissed · comment-noise-audit · `src/__tests__/lib/kosztorys/columns/column-values.test.ts:96` · carries the why (worker surface reads all etapy)
- [x] fixed · simplify · `src/lib/kosztorys/print/columns.ts` · `computedPercentColumn` looked the resolver up per row — hoisted, fails fast on an unknown key like its siblings
- [x] fixed · simplify · `src/lib/i18n/dictionaries/{pl,uk,ru}.ts`, `src/lib/kosztorys/header-tips.ts` · a new `tipPlannedQtyWorker` sat beside `tipPlannedQty`, whose uk/ru text had no reader since EX-921 — folded into `tipPlannedQty`; the editor's marża wording is a literal in `HEADER_TIPS`
- [x] fixed · simplify (altitude) · `src/lib/kosztorys/columns/column-values.ts:66` · the worker surface overrode the all-etapy quantity column by column (`remainingForPlane`, now `plannedDonePercent`) — one `qtyDone` source that `remaining`, `donePercent`, `plannedDonePercent` and `remainingForPlane` all read; a forgotten override can no longer print the worker's own share
- [x] filed · simplify (altitude) · `src/migrations/20261009_*` · each hidden-by-default document column costs a migration, a deploy-order rule and a leak window, because the stored value is the hidden set — a sparse `key → hidden` map read against the code default removes all three; a stored-contract change, out of scope here — filed EX-1033
- [x] dropped · simplify (altitude) · `src/__tests__/components/kosztorys/editor/grid/column-value-parity.test.ts:120` · exclusion list grows with each all-etapy column — the worker grid has no sort, so the parity is moot there; reworking the fixture buys nothing
- [x] dropped · simplify · `src/lib/kosztorys/header-tips.ts:41` · editor tip for the percentage repeats two lines of `pl.grid.tipPlannedDonePercent` — the first lines and the `CLIENT_BASE` tail genuinely differ; a shared fragment would be worse
- [x] dropped · simplify · `src/lib/kosztorys/columns/column-values.ts:108` · `executedQtyByItem[row.id] ?? 0` twice — a helper over two call sites gains nothing
- [x] dismissed · reuse-scan · UI diff (`kosztorys-v2-columns.tsx`, worker-view dialog) · one `resolvedColumn(…, formatPercent)` line and one text change — nothing reinvented

## Simplify pass

Ran `/simplify` (reuse, simplification, efficiency, altitude) + `primitive-reuse-scan` — 4 applied, 1 filed (EX-1033), 3 dropped; each folded into ## Findings (tagged `simplify` / `reuse-scan`).

## Tests & suite

Not run — the test hook blocks typecheck / specs until the user asks („odpal testy”). Owed: typecheck + the 10 touched specs (`column-values`, `settlement-columns`, `kosztorys-layer`, `kosztorys-money-axis`, `column-value-parity`, `client-view/settings`, `print/offer`, `print/worker`, `worker-view/columns`, `worker-view/settings`).
