# Review-gate ledger — staging sweep 14.10 18:00 → 15.10 · 2026-10-15

Scope: every non-merge commit authored 2026-10-14 18:00 → `d9f419c83`, 30 code commits in two clusters:

- **A — kosztorys editor / AI / tree writes:** `89e10297d 15e8ab35e 64eb9ef87 86602a129 5910e43e6
0368751dd 6692335be d9be6fbd5 519c2e7e4 9281cb0a0 7ea361d3a fa492a5a2 a59c41303`
  (recheck flag + Nowe informacje, AI rounds, EX-1057, EX-1052, EX-1002, EX-1036, EX-1035, EX-950)
- **B — worker report / transfers / media / misc:** `e1198ba3d 49f243acb aa2aa59c5 caf493665 d59bcbd57
ab380509e b20ad5a08 d08aa0567 9c9b3780b 782fe255d 7b828648c ff1690df1 f3c3f1629 7a8eafd8d f18c13478
0f4b161a4 d9f419c83` (EX-1004, EX-1055, EX-1021, EX-862, EX-1053, EX-983, EX-1007, EX-958 markers)

Out of scope: `03613a901` EX-855 adapter swap (authored 13.10, only merged today); `485964557` /
`b7b62700d` EX-1033 (another session's slice, own change folder); the dirty tree (another session).
Doc-only commits are not code-reviewed.

Checks: code-review (×2, one per cluster), comment-noise-audit, feature-first-structure +
module-cohesion-audit + structure-scatter-audit, tailwind-v4-audit, 10x-impl-review (EX-950 only —
the one active `plan.md`). Step 0.5 browser pass dropped: Playwright only on explicit ask.

## Findings

_Trimmed at archive (2026-10-15): `fixed` findings dropped — their record is the commit. Pre-trim tally: 16 fixed, 3 skipped, 10 dismissed, 12 dropped, 0 open._

- [x] 🔵 OBSERVATION · skipped · code-review A · `ai-review-columns.tsx` `deleteValue` · Delete/paste-blank on the
      Status column lowers the recheck flag along with the verdict — owner's call whether clearing the verdict
      should also clear „Do ponownego sprawdzenia”; raised in the close-out, no change until ruled
- [x] 🔵 OBSERVATION · dismissed · impl-review · `kosztorys-editor-v2.tsx:35,60` · plan 1.3 (refresh in
      `startRefresh`) has no test — the reviewer advised against one (it would pin Next's transition internals);
      covered by the EX-950 manual check
- [x] 🔵 OBSERVATION · dismissed · code-review B · `add-line-to-rozpiska.tsx` `pointAt` + `worker-report-review.tsx:247`
      · out-of-order pointer save vs „Cofnij podmianę” clear — Next dispatches a tab's server actions one at a time
      in call order, so the clear can't overtake the save
- [x] 🔵 OBSERVATION · dropped · code-review B · `lib/db/worker-reports.ts:520` · a gone rozpiska line re-pointed
      stays draft-only — EX-1055 is scoped to extras on purpose; gone-line + re-point + reopen is a triple-rare path
- [x] 🔵 OBSERVATION · dismissed · code-review B · `lib/db/worker-reports.ts:361` · Podgląd shows a pointed,
      unaccepted extra's pozycja early — matches how an undone extra already reads there
- [x] dropped · code-review B · `harden-file-headers.ts` · forced `attachment` drops the filename — no stored file
      is served through that path with a meaningful name today
- [x] dropped · comment-noise · `media-response-headers.test.ts:4` · near-duplicate of the `harden-file-headers.ts`
      JSDoc, but it carries the dated external verification — not worth the churn
- [x] skipped · simplify · `use-restore-remount.ts` · altitude: let the latch run its own refresh transition
      (counter-stamped arms) instead of reading the caller's `isRefreshing` + `ownsRefresh` — a review-worthy
      rewrite of a latch that has regressed three times; today's fix is behaviour-correct and tested
- [x] skipped · simplify · `kosztorys-editor-v2.tsx` `handleStaleTree` · altitude: one stale-recovery path for
      cell-write NOT_FOUND and tree-replace NOT_FOUND — reconciles two toasts and six callers; same refactor as above
- [x] dropped · simplify · `settle-tree-replace.ts:33` · `{ refetch, stale }` → `{ reason }` enum — three files of
      churn to save one implied boolean
- [x] dismissed · simplify · `transfer-filters.ts:97,203` · altitude: have the builder emit `and: [{ or }]` —
      `kasa/[id]/page.tsx` writes its own top-level `or` too, so the hoist in `andWith` is the one general guard
      at the composition seam; moving the rule into every `Where` writer makes it weaker, not deeper
- [x] dismissed · simplify · `worker-report-review.tsx:250`, `add-line-to-rozpiska.tsx:53` · two copies of the
      `pointReportLineAction` call — both files carry another session's uncommitted changes; not mutating them
- [x] dropped · simplify · `add-line-to-rozpiska.tsx:46` · altitude: write `item_id` in the pozycja's insert
      transaction — couples two generic create actions to worker reports for a small failure window
- [x] dropped · simplify · `accept-worker-report.ts:138` · reject-only early return repeats the tail's
      `setLinesRejected` ×2 + `settleReport` — borderline; the early return reads clearer than a conditional tree read
- [x] dropped · simplify · `context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/load-draft-sql-prod.ts:68`
      · `updates`/`inserts` built and unused in ROUND mode; matching repeated in `roundSql` — a one-off prod loader
      a human runs; restructuring it costs a re-verification against prod for no runtime gain
- [x] dropped · simplify · `scripts/load-ai-draft.ts:76,139` · `itemKeys` re-keys what the loop keys again; the
      `if (!section) continue` is TS narrowing, not dead code — one-off local script
- [x] dismissed · simplify · `lib/actions/investment-assets.ts:39` · `removeAllInvestmentAssetsAction` unused
      since EX-862 hid the button — kept on purpose until the file trash lands (EX-862 commit message)
- [x] dropped · simplify · `kosztorys-editor-body.tsx:416-437` · `reportedQtys` / `recheckRowIds` join strings
      reset every row height per keystroke — ~1-3 ms on a few hundred rows
- [x] dropped · simplify · `transfer-table-server.tsx:31` · `fetchAllDraftTransferIds` awaited before the
      `Promise.all` — the parallel candidate `fetchReferenceData` is cached (`unstable_cache` + `cache`), nothing to win
- [x] dropped · reuse-scan · `scripts/load-ai-draft.ts:76` · item key built twice — one-off script (same as the
      simplify line above)
- [x] dismissed · module-cohesion-audit · `transfer-filters.ts:203` · `andWith` is a generic `Where` combinator —
      every consumer composes transfer filters; promote when a non-transfer consumer appears
- [x] dismissed · module-cohesion-audit · `use-kosztorys-editor.ts`, `kosztorys-editor-body.tsx`, per-table
      `lib/db` files, grid `cells/*` multi-exports — pre-existing size, slice made them smaller or added one
      cohesive unit each (EX-515 split already deferred; body branches kept by decision `8be7511c9`)
- [x] dropped · structure-scatter-audit · `report-grid.tsx:20` · imports `GRID_TEXT_SIZES` from a hook file read
      from 4 directories — moving the constant out of the hook is cosmetic; import direction is correct
- [x] dismissed · feature-first-structure · all added files (`harden-file-headers.ts`, `ai-round.ts`,
      `cell-font-size.test.tsx`, new db/query/action fns, migrations `_4…_6`) — in their rule-given homes
- [x] dismissed · tailwind-v4-audit · `src/styles/globals.css:270-300` · `var(--grid-cell-text-phone, …)` in
      `@utility` blocks — v4-native runtime text-size utilities on theme tokens; nothing else flagged across
      the 30 commits (no bracket `var()`, no inline `style`, no arbitrary values)

## Simplify pass

Ran /simplify (4 agents: reuse, simplification, efficiency, altitude) — 4 applied, 0 proposed, 12 skipped /
dropped / dismissed; each folded into ## Findings (tagged simplify). primitive-reuse-scan (homes from
`.reuse-scan.json`) — 1 fixed, 1 dropped, 13 candidates verified as non-matches.

## Tests & suite

- `pnpm typecheck` — clean.
- `pnpm test` (node + dom) — 577 files / 6000 tests passed, 147 files skipped (DB-gated), 221 s.
- e2e / integration / build — not run (not asked; e2e only on explicit request).

Archive: blocked on unticked manual checks in `context/foundation/manual-checks.md` (EX-950 et al.), not on
the ledger — every box above is checked.
