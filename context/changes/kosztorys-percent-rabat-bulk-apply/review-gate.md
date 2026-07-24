# Review-gate ledger — kosztorys-percent-rabat-bulk-apply · 2026-07-24

Diff scope: `2d474610^..HEAD` (p0 `2d474610`, p1 `c5f4079e`, p2 `f4605bf4`, docs `b2a9ce0d`) + working-tree gate edits.
Fan-out: impl-review, code-review, tailwind-v4 (clean), feature-first (clean), module-cohesion, structure-scatter, comment-noise (0 delete/0 trim).

## Findings

<!-- most-severe first; open boxes first within tier -->

- [x] 🔵 fixed · code-review+impl-review · `summary-settings-bar.tsx:77` + `percent-rabat-tool.tsx` · Percent tool silently no-op'd when an amount global discount was active — owner chose "disable the tool while amount-mode is active": `PercentRabatTool` now takes `disabled={globalDiscount.type != null}`, greying the input/button and swapping the hint to explain why.
      test: no automated test now — browser-level guard folded into EX-564 manual verification (new Phase 0 check added); E2E deferred with the rest of the slice's browser coverage.
- [x] 🟡 fixed · code-review · `src/lib/actions/kosztorys.ts:167` · Bulk overwrite flattened hand-tuned per-item rabaty with no snapshot — added `captureAutoSnapshot(db, investmentId, user.id)` before the UPDATE, mirroring removeSectionAction's destructive-write guard.
      test: integration — `src/__tests__/lib/actions/kosztorys-bulk-rabat-snapshot.test.ts` asserts the auto-snapshot id rises AND the row is overwritten to `percent X`; green vs local DB (611ms).
- [x] 🟡 dismissed · impl-review · `kosztorys-global-settings.tsx:357` · Unrelated subcontractor coeff-label tidy bundled into p1 (c5f4079e) — benign cosmetic (label shortening + InfoTooltip), no behavior change; already shipped, not worth a revert.
- [x] 🔵 dropped · impl-review · `src/lib/actions/kosztorys.ts:170` · Action returns success on a 0-row UPDATE — an empty kosztorys yields an empty optimistic patch too, so no user-visible drift; not worth the churn.
- [x] 🔵 dismissed · code-review · `use-kosztorys-editor.ts:933` · Rollback captures `prev` pre-await; a concurrent edit landing during the round-trip is clobbered on failure — systemic across every optimistic handler (applyVat, handleGlobalDiscountChange), not a regression this slice introduced.
- [x] 🔵 dismissed · code-review · `src/lib/actions/kosztorys.ts:160` · Raw SQL bypasses collection access control / no per-investment ownership check on `investmentId` — consistent with all repo financial raw-SQL writes; `protectedAction` gates to management roles; SQL is correctly parameterized.
- [x] 🔵 dismissed · code-review · `summary-settings-bar.tsx:69` · Switching select to "zł" reinterprets a legacy `percent` row's `value` as an amount — bites only legacy dev rows; kosztorys data is throwaway pre-dogfooding (AGENTS.md).
- [x] dismissed · module-cohesion · `use-kosztorys-editor.ts` · 1105-line god module — pre-existing, tracked EX-515 (deferred: needs test harness first); slice appends one handler consistent with the file's own pattern.
- [x] dropped · structure-scatter · `src/lib/kosztorys/percent-rabat.ts` · Action schema pulled into a standalone lib file while all sibling action schemas are inline — justified (a unit test imports it); single instance, not worth a convention change now.
- [x] fixed · structure-scatter · `percent-rabat.ts:13` · Dead export `ApplyPercentRabatT` (no importer) — removed.
- [x] fixed · comment-noise · `actions/kosztorys.ts:63`, `types.ts:18`, `summary-settings-bar.tsx:12` · "no longer stored" vanished-state phrasing ×3 — reworded to drop the historical tell, kept the live pointer to applyPercentRabatToAllItemsAction / PercentRabatTool.

## Simplify pass

Ran /simplify (4 angles) — 2 applied, 0 proposed, 1 dropped; each folded into ## Findings (tagged simplify). Efficiency: 0 findings (snapshot→UPDATE correctly sequential; subcontractor calc/columns paths got cheaper). Altitude: structure confirmed sound (single calc choke point `netForQtyForView`; percent-apply is a bulk editor over existing per-item storage, not a parallel discount mechanism).

- [x] fixed · simplify · `use-kosztorys-editor.ts:933` · `handleApplyPercentRabat` hand-rolled the success/refresh/rollback/toast tail — now reuses `optimisticSettingSave` (its return type widened to `boolean`; 4 existing callers ignore it).
- [x] fixed · simplify · `percent-rabat-tool.tsx:29` · Client `valid` bounds duplicated `applyPercentRabatSchema` — now gates on `applyPercentRabatSchema.safeParse({ percent }).success`.
- [x] dropped · simplify · `percent-rabat-tool.tsx:52` · Input `<input>` duplicates `DecimalField`'s styling — the correct fix needs a controlled mode on the shared primitive (review-worthy refactor, behavior-sensitive); minor visual-drift risk, not worth extending DecimalField in this slice.

## Tests & suite

- Typecheck (`tsc --noEmit`): green (after every edit batch).
- New integration test `kosztorys-bulk-rabat-snapshot.test.ts`: 1 passed vs local DB; skips without DB env (portable).
- Fast legs (user chose to skip e2e, Step 3 gate): typecheck green, lint green, 278 unit tests pass (35 DB-gated skipped). Re-verified green after the disable-guard edit.
- Full suite / e2e: skipped by user — slice can't archive yet (manual verification pending), so e2e adds no unblock signal.

## Manual verification

EX-564 (`context/foundation/manual-checks.md:942`) — all Phase 0/1/2 boxes pending. Archive blocker #2 (independent of the findings).
