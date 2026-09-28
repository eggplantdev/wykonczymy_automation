# Review-gate ledger — staging `origin/staging..19310ba6` · 2026-09-28 (evening)

Scope: everything not yet pushed to `origin/staging` — 14 commits `cae0bf78..19310ba6`, 88 files
(+3793/−2697), plus the working tree. The working tree equals `HEAD` for every source file; the only
real worktree edit was a broken indent in `context/archive/reviews/2026-09-28-staging.md:158`. The
index holds a stale lint-staged leftover (pre-prettier versions of 14 files) — not a change.

Changes: `investor-change-history` (implementing, p1–p6 + compare-with-current),
`kosztorys-remaining-skip-overrun` (implemented, p1–p2 + epilogue), two standalone fixes
(`296bb4ae` header row 84, `07ee8edc` preview column titles), docs/archive commits.

Fan-out: impl-review (2 plans) · code-review (high) · tailwind-v4 · comment-noise (flag-only) ·
feature-first + module-cohesion + structure-scatter (diff-scoped, one agent).

Step 0.5 (verify-manual-checks / browser) — SKIPPED: not requested; `19310ba6` already records a
staging manual pass. Manual verification stays a separate archive blocker (Step 4).

## Findings

<!-- working tree -->

- [x] fixed · worktree · git index · stale lint-staged leftover staged in 14 files: pre-prettier
      versions and a missing `.kosztorys-history-removed` rule in `globals.css`. A bare `git commit`
      would have shipped the reformat-reversal and deleted the struck-through history row style.
      Worktree already equalled `HEAD` → `git restore --staged`, nothing lost
- [x] fixed · worktree · `context/archive/reviews/2026-09-28-staging.md:158` · list-continuation
      line lost its indent (stray formatter edit, not authored) → restored from `HEAD`

<!-- impl-review (plan A: REJECTED on F1; plan B EX-885: APPROVED) + code-review (high) -->

- [x] 🔴 CRITICAL · fixed · impl-review F1 · `select-history-entries.test.ts`, `history-dialog.test.tsx`,
      `history-view.test.tsx` · history specs broken at HEAD (`tsc` exit 2 + 6 vitest failures). Specs
      updated to the shipped API: controlled `HistoryDialog`, `buildHistoryEntries(…, current)`, counts
      vs current (new case pins it), the „Fugi" query scoped to the grid row, the moved history trigger
      test: no automated test — the fix IS the specs; 45/45 green, `tsc` clean
- [x] 🟡 WARNING · fixed · impl-review F3 + code-review #1 · `src/lib/kosztorys/history/change-rows.ts:48` ·
      a pozycja whose only change was its own rabat produced no row → „Bez różnic" beside a changed grid.
      An item with no typed change now lists its wartości („Wartość netto przedmiar" / „Wartość netto")
      test: TDD · unit — `change-rows.test.ts` rabat-only case, red then green
- [x] 🟡 WARNING · fixed · impl-review F2 · `plan.md`, `design.md` #4, `kosztorys-editor-domain-notes.md` ·
      owner kept the shipped „count vs current"; plan (list, Phase 3 §3, cache contract, perf, Phase 5,
      spec paths, 3.3), design #4 and domain notes amended with the `7eee889e` pointer
- [x] 🟡 WARNING · fixed · impl-review F4 · `preview-header-actions.test.tsx` (new) · worker gating now
      opens „Opcje" and asserts the item absent, beside a positive control for the investor;
      `history-grid.test.ts` (new) covers an etap added since; `change-rows.test.ts` (new)
      test: TDD · dom + unit — 2 + 3 + 2 cases
- [x] 🟡 WARNING · fixed · impl-review F5 · `context/foundation/manual-checks.md:1218` · rewritten to
      „no repeated titles"; **unticked** — the new wording was never verified
- [x] 🟡 WARNING · fixed · impl-review F6 · `manual-checks.md` · `investor-change-history` section added
      (9 checks from the plan's Manual Verification); `change.md` → `implemented`
- [x] 🔵 OBSERVATION · fixed · impl-review F8 + code-review #2 · `src/lib/queries/preview-kosztorys-history.ts:98` ·
      owner: keep any `auto` row openable; docblock + domain notes now say scope = investment + kind
      test: no automated test — behaviour unchanged by decision, docs only
- [x] 🔵 OBSERVATION · dismissed · code-review #3 · `preview-header-actions.tsx` · owner: „Pokaż wszystkie
      pozycje" stays available while „Podsumowanie" is open
- [x] 🔵 OBSERVATION · fixed · impl-review F9 · `src/lib/queries/preview-kosztorys-history.ts:84` · the
      history read is guarded in `readInvestorHistory` (both pages): failure → `null`, the page renders the
      present without history, `SENTRY-REQUIRED` marker
      test: no automated test — a try/catch; the failure needs a corrupt row to provoke
- [x] fixed · impl-review F7 + code-review #5 · `preview-kosztorys-history.ts:55` · tags narrowed to
      `KOSZTORYS_TREE_TAGS` + `kosztorysSnapshots` (`buildKosztorysTree` reads only those tables)
- [x] fixed · code-review #7 · `diff-versions.ts:98` · `WeakMap` memo per tree — the current tree is
      flattened once per list build, not once per entry
- [x] fixed · code-review #6 · `kosztorys-import.ts:247` · stale comment + extra `getKosztorysTree` gone;
      `tree.globalDiscount` from the serialized payload
- [x] fixed · code-review #8 + F10 · `counted-nouns.ts`, `history/types.ts`, `change-rows.ts`,
      `diff-versions.ts` · dead `itemAddedPhrase`, `itemRemovedPhrase`, `ItemChangeT.currentItemId`, `ChangeRowT.key` removed
- [x] fixed · code-review #9 · `snapshots.ts:88,241` · `LOCKED_INVESTMENT_STATUS` / `TEMPLATE_INVESTMENT_STATUS`
      (`NOT IN` — equivalent over the 4 statuses today, and a new open status is eligible by default)
- [x] dismissed · impl-review F10 · `kosztorys-editor-body.tsx:135-146` · the three `useMemo` follow the
      file's own idiom (12 more beside them); a compiler sweep of the file is its own change
- [x] fixed · impl-review F10 · `kosztorys-v2-columns.tsx:356` · shared `overrunTone`; the worker column
      reads its remaining once through `remainingForWorker`
- [x] fixed · impl-review F10 · `daily-snapshots/route.ts` · docblock: a manual re-run after an
      `unchanged` night stamps that morning's edits onto yesterday
- [x] skipped · code-review #4 · `src/lib/queries/preview-kosztorys-history.ts:32` · list build loads
      every candidate payload + diffs each. Cached; entries = edited days (≤ ~100); #7 cuts the flattening.
      Lazy-on-open is a design change — revisit only if measured
- [x] dropped · impl-review F5 · `07ee8edc` · swept history hunks → doesn't compile alone (bisect gap).
      Rewriting 14 commits for bisect purity isn't worth it; recorded here
- [x] dismissed · code-review #10 · `src/lib/kosztorys/settlement-columns.ts:41` · reviewer's own false
      positive — the `filled.size === 0` read needs the ∩ stages filter

<!-- feature-first / cohesion / scatter -->

- [x] fixed · scatter + cohesion · `capture-daily-snapshots.ts` → `src/lib/utils/days.ts` ·
      `warsawMidnight` / `endOfPreviousWarsawDay` moved; spec block → `lib/utils/days.test.ts`
- [x] fixed · feature-first · `preview-header-actions.tsx` → `editor/preview-header-actions.tsx`
- [x] fixed · scatter · `SnapshotKindT` → `snapshot-format.ts`; the `db/snapshots` ↔ `history/types`
      type cycle is gone
- [x] fixed · feature-first · `history-view.test.tsx` → `editor/kosztorys-editor-body-history.test.tsx`
  - `editor/preview-header-actions.test.tsx`
- [x] dismissed · cohesion · `snapshots.ts`, `change-rows.ts`, `counted-nouns.ts`, `preview-kosztorys.ts`,
      `kosztorys-snapshots.ts` · single-topic; growth on-topic
- [x] skipped · cohesion · `kosztorys-editor-body.tsx:134-146` · history cluster → `useHistoryGrid` only
      if the body is ever split; 4 derived values, not worth a split alone
- [x] skipped · scatter · `lib/kosztorys/` root · snapshot write side flat beside `history/` read side;
      predictable today, a `snapshots/` subdir is its own refactor

<!-- tailwind-v4 -->

- [x] dismissed · tailwind · `src/components/ui/button.tsx:38` · arbitrary _variant_ mirroring the base
      line's shadcn pattern; `cn()` resolves the size conflict
- [x] dropped · tailwind · `eslint.config.mjs` · no Tailwind-aware lint plugin — same finding dropped in
      the morning ledger (arm64 `pnpm install` risk)

<!-- comment-noise (flag-only; 18 delete, 6 trim) -->

- [x] fixed · comment-noise · 17 files · applied 13 deletes + 6 trims (incl. the inaccurate
      `history-banner.tsx:11` and the rabat comment duplicating `HistoryDiscountT`'s)
- [x] dismissed · comment-noise · `stamp-completed-at.test.ts:57`, `snapshots.test.ts:182`,
      `serialize-restore-roundtrip.test.ts:231`, `settlement-rows.test.ts:6`, `history-banner.tsx:41` ·
      flagged for deletion but each carries the _why_ its test title doesn't — kept

<!-- simplify (reuse · simplification · efficiency · altitude) -->

- [x] fixed · simplify · `select-history-entries.ts:68` · the list built every change row (each
      formatted through `toLocaleString`) only to read `.length` → `countChangeRows` in `change-rows.ts`,
      sharing `shownChanges` so the count and the view cannot disagree; a spec pins count = rows
- [x] fixed · simplify · `diff-versions.ts:25,83` · money compared by `roundToCents` → `MONEY_TOLERANCE`,
      the documented half-grosz rule (`calc.ts:16`)
- [x] fixed · simplify · `change-rows.ts:27` · `withUnit` duplicated `scopeQuantityText` → shared
      `formatQtyWithUnit` in `format.ts`, both call it
- [x] fixed · simplify · `db/snapshots.ts:182,207` · `kind IN ('auto','daily','named')` written twice →
      one `IS_HISTORY_KIND` fragment; list and by-id read must agree
- [x] fixed · simplify · `history-dialog.tsx:35` + both share pages · `wersja` spelled in three places →
      `VERSION_PARAM` beside `parseVersionParam`
- [x] fixed · simplify · `history/types.ts` · `kind` on `HistoryEntryT`/`PastVersionT`, `discount` on
      `PastVersionT` and on `{ state: 'same' }` — read by tests only, shipped to the client → removed
- [x] fixed · simplify · `history-grid.ts:24` · identity `Map` column→field → a `Set`
- [x] fixed · simplify · `diff-versions.ts:141-166` · two copies of the stage-field push → one
      `stageColumns` list built per diff (also `stageLabel` once per etap, not per row × etap)
- [x] fixed · simplify · `select-history-entries.ts:52` · `versionOf` callback + an unreachable
      „vanished mid-read" throw → the caller passes `{ meta, version }[]`
- [x] fixed · simplify · `preview-kosztorys.ts:34`, `capture-daily-snapshots.ts:9` · dead exports
      `PREVIEW_KOSZTORYS_TAGS`, `DailyCaptureResultT` → module-private
- [x] fixed · simplify · altitude · `kosztorys-editor-body.tsx:134` + `preview-header-actions.tsx:36` ·
      crew gate on the history enforced twice → once in the body (`investorHistory`), the actions take no
      `worker`; one `pastVersion` drives panel + toggle
      test: TDD · dom — body spec „never hands the history to a crew", header spec with/without history
- [x] fixed · simplify · efficiency · `k/[token]/page.tsx:18,22` · share token resolved twice per load →
      `resolveShareInvestmentId` wrapped in React `cache()` (per request; revocation still next-request)
- [x] skipped · simplify · altitude · `preview-kosztorys-history.ts:106` · one entrance per door returning
      `{ data, history }` — merges two auth paths; a review-worthy refactor, and `cache()` already removed
      the doubled token read
- [x] skipped · simplify · efficiency · share pages · start the history list alongside the preview read —
      needs the history API split; ~10–50 ms on a cache hit
- [x] skipped · simplify · efficiency · `history-changes-table.tsx:38` · virtualize the change table —
      unmeasured, and jsdom's virtualizer renders no rows, so the banner specs would lose their subject
- [x] dropped · simplify · efficiency · `preview-kosztorys-history.ts:29` · a second `buildKosztorysTree`
      after an edit — once per write, agent itself unsure `cache()` reaches inside `unstable_cache`
- [x] dropped · simplify · `diff-versions.ts:47,67,114,173` · matchers returning their leftovers —
      four `Set`s over ≤ 1000 ids; a rewrite of both matchers for no measurable gain
- [x] dismissed · simplify · `db/snapshots.ts:98` · `latestSnapshot(…, kind)` with one caller — a kind
      parameter is the natural data-access shape, not over-generalization

<!-- reuse-scan (catalogue: src/components/ui, src/hooks, src/lib/**, src/types) -->

- [x] dropped · reuse-scan · `history-change-cell.tsx:26` / `history-changes-table.tsx:26` · struck-through
      „było" value written twice — in-diff copy of one className; the arrangements differ (inline `→` in a
      cell vs two table columns), so a shared component would wrap a string
- [x] dismissed · reuse-scan · `history-banner.tsx:33` · „Rabat nieznany" muted `<p>` vs `Description` —
      without its icon `Description` is the same `<p>`; with it, a visual change nobody asked for
- [x] dismissed · reuse-scan · `history-dialog.tsx:30` · empty-list `<p>` vs `EmptyState` — that is a
      centred page-level `h2` + text, wrong shape for one line inside a dialog
- [x] dismissed · reuse-scan · `history-banner.tsx:41` · `max-h-64 overflow-auto` vs `SummaryScrollRegion`
      — that one fills a flex parent (`flex-1`), this one caps a height; different contract

## Simplify pass

Ran /simplify (4 agents) — 12 applied, 3 skipped, 2 dropped, 1 dismissed; `tsc` clean, eslint
clean, 568 unit/dom + 17 DB specs green. Findings folded into ## Findings (tagged simplify).
Then primitive-reuse-scan — 0 fixed, 1 dropped, 3 dismissed; the history UI already routes through
`formatPLDate`, `pluralize` (`counted-nouns`), `DataTable`, `ReadOnlyCellText`, `Dialog*` and
`DropdownMenu*`.

## Tests & suite
