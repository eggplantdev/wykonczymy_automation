# Review-gate ledger — kosztorys-fit-all-columns · 2026-10-07

Scope: `1002b5688..be5f0afdc` (no untracked files). Checks: code-review, comment-noise-audit (flag-only),
module-cohesion-audit, tailwind-v4-audit. Dropped: 10x-impl-review (no `plan.md`), feature-first /
structure-scatter (no new files). Step 0.5 skipped — the browser pass needs Playwright, not asked for.

## Findings

- [x] 🟡 WARNING · fixed · code-review · `src/lib/kosztorys/row-content-lines.ts:8` · „j.m." (a single-line combobox) was measured, so a long custom unit grew the row for nothing — added to `UNMEASURED_COLUMN_IDS`
      test: TDD · unit — `measuredColumns` spec now asserts `unit` is skipped
- [x] 🟡 WARNING · dismissed · code-review · `src/lib/kosztorys/row-content-lines.ts:27` · editable numeric cells (single-line input) are measured too — unreachable: numbers are one short word and every numeric column is ≥100px wide, so they never wrap
      test: no automated test — no reachable failure
- [x] 🟡 WARNING · dismissed · code-review · `kosztorys-editor-body.tsx:375` · `measured` gets a new identity on every `columns` rebuild, so the per-row cache and the fit context's value churn — the width cache is module-level, only visible rows are measured, and the context's only consumer is the row-height menu; the measurement hook's churn is fixed (see simplify)
      test: no automated test — perf, bounded
- [x] 🔵 OBSERVATION · dropped · code-review · `src/lib/kosztorys/row-content-lines.ts:33` · a number is measured as its copied text (no thousands separator / unit), so it can under-count — cosmetic, only on narrow columns
      test: no automated test — cosmetic
- [x] 🔵 OBSERVATION · fixed · code-review · `kosztorys-editor-body.tsx` · `contentLinesFor` and the clip cue each measured every column per row — one per-row `columnLinesFor` cache now feeds both
      test: no automated test — perf, no behaviour change
- [x] fixed · code-review · `src/lib/kosztorys/row-content-lines.ts:48` · the text was computed before the width check — width checked first
- [x] 🔵 OBSERVATION · fixed · code-review · `kosztorys-editor-body.tsx` · a row-height drag wiped the cached line counts — line counts are cached apart from heights now
      test: no automated test — perf, no behaviour change
- [x] 🔵 OBSERVATION · dropped · code-review · `use-wrap-column-widths.ts:50` · an id reaches `querySelector` unescaped — every id today is `[A-Za-z0-9_]`
      test: no automated test — no reachable failure
- [x] 🔵 OBSERVATION · dismissed · code-review · `ai-review-columns.tsx:135` · Ctrl+C on „Komentarz do pracy" now copies the note — intended, paste stays a no-op
      test: no automated test — intended
- [x] fixed · comment-noise · `src/lib/kosztorys/row-content-lines.ts:18,24` · two comments restating `CopyableColumnT` / the `flatMap` skip — deleted
- [x] fixed · comment-noise · `kosztorys-editor-body.tsx:327,418` · header-class comment and the „…" contrast sentence — deleted
- [x] fixed · comment-noise · `row-content-lines.test.ts:50` · history comment restating the test name — deleted
- [x] fixed · comment-noise · `kosztorys-editor-body.tsx:371` · stale „size themselves to their Opis prac" — now „to their content"
- [x] dropped · comment-noise · `src/lib/kosztorys/row-content-lines.ts:5` · trim „Every column is measured by default" — borderline, kept as the anchor of the rationale
- [x] fixed · comment-noise · `src/lib/kosztorys/row-content-lines.ts:46` · duplicated the hook's „a column the client cannot see" sentence — removed from the lib
- [x] fixed · simplify · `kosztorys-editor-body.tsx` · the row height was resolved twice (grid `rowHeight` and the clip cue) — one `rowHeightFor` feeds both
- [x] fixed · simplify · `kosztorys-editor-body.tsx` · `isSectionHeaderRow` / `isSectionFooterRow` beside `isSyntheticRow` were redundant (`id < 0` covers both) — removed
- [x] fixed · simplify · `use-wrap-column-widths.ts:32,49` · `(string | undefined)[]` + `if (!id) continue` dead after `measuredColumns` — `string[]`, guard removed
- [x] fixed · simplify · `src/lib/kosztorys/row-content-lines.ts` · `columnLines` returned an array searched with `find` per cell — returns a `Map`, `ColumnLinesT` gone
- [x] fixed · simplify · `kosztorys-editor-body.tsx` · `measuredIds` rebuilt on every edit tore down the width measurement each time — keyed on the joined ids
- [x] dropped · simplify · `use-wrap-column-widths.ts` · one `querySelectorAll` instead of one query per column — ~1–2 ms per measure
- [x] dropped · simplify · `kosztorys-editor-body.tsx:376` · pass `measured` to the hook instead of `measuredIds` — keeps the hook free of `MeasuredColumnT`
- [x] dropped · simplify · `wrapColumnClass` / `useWrapColumnWidths` · names still say „wrap" though they now cover every measured column — cosmetic rename
- [x] dismissed · simplify · `src/lib/kosztorys/row-content-lines.ts:8` · exclusion by id rather than an opt-out at each column factory — four ids, each in one factory, no shared select factory to carry a flag; kept

Clean: module-cohesion-audit, tailwind-v4-audit.

## Simplify pass

Ran /simplify (4 agents: reuse, simplification, efficiency, altitude) — 5 applied, 0 proposed, 4 dropped/dismissed; each folded into ## Findings (tagged simplify). No separate report file.

## Tests & suite

- typecheck (`tsc --noEmit`): green
- eslint on the touched files: green
- vitest, kosztorys row-height / editor-body / editor hooks / grid specs: 51 files, 368 tests green
- full suite (`pnpm test`, e2e, build): not run — user picked the fast legs
- E2E: none owed — cosmetic grid gesture, covered by the manual checks
