# Review-gate ledger — kosztorys-fit-all-columns · 2026-10-07

Scope: `1002b5688..be5f0afdc` (no untracked files). Checks: code-review, comment-noise-audit (flag-only),
module-cohesion-audit, tailwind-v4-audit. Dropped: 10x-impl-review (no `plan.md`), feature-first /
structure-scatter (no new files). Step 0.5 skipped — the browser pass needs Playwright, not asked for.

## Findings

- [x] 🟡 WARNING · dismissed · code-review · `src/lib/kosztorys/row-content-lines.ts:27` · editable numeric cells (single-line input) are measured too — unreachable: numbers are one short word and every numeric column is ≥100px wide, so they never wrap
      test: no automated test — no reachable failure
- [x] 🟡 WARNING · dismissed · code-review · `kosztorys-editor-body.tsx:375` · `measured` gets a new identity on every `columns` rebuild, so the per-row cache and the fit context's value churn — the width cache is module-level, only visible rows are measured, and the context's only consumer is the row-height menu; the measurement hook's churn is fixed (see simplify)
      test: no automated test — perf, bounded
- [x] 🔵 OBSERVATION · dropped · code-review · `src/lib/kosztorys/row-content-lines.ts:33` · a number is measured as its copied text (no thousands separator / unit), so it can under-count — cosmetic, only on narrow columns
      test: no automated test — cosmetic
- [x] 🔵 OBSERVATION · dropped · code-review · `use-wrap-column-widths.ts:50` · an id reaches `querySelector` unescaped — every id today is `[A-Za-z0-9_]`
      test: no automated test — no reachable failure
- [x] 🔵 OBSERVATION · dismissed · code-review · `ai-review-columns.tsx:135` · Ctrl+C on „Komentarz do pracy" now copies the note — intended, paste stays a no-op
      test: no automated test — intended
- [x] dropped · comment-noise · `src/lib/kosztorys/row-content-lines.ts:5` · trim „Every column is measured by default" — borderline, kept as the anchor of the rationale
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
