# Review-gate ledger — qa-pass-fixes · 2026-10-06

Scope: uncommitted working tree vs `HEAD` (8925a469, `staging`).

1. Fixes from the 2026-10-05 manual-check passes 5–13 (worker report „Tylko zgłoszone” latch + empty
   state, „Zgłoś prace” only on the worker's own page, i18n of dialog close / zoom / delete labels,
   „nie przypisany do etapu” hints, catalogue-swap unit, worker-form `c-ref` column) + their
   manual-checks registry entries.
2. `ai-kosztorys-generation-tests` round 4 — comparison against the owner's #175 (docs + one script).

Step 0.5 (verification) already ran as passes 5–13 on staging; its fixes and regression specs are in
the reviewed diff. Checks: code-review, tailwind-v4-audit, comment-noise-audit, file-organization
(feature-first + cohesion + scatter, one agent — diff is ~100 code lines). impl-review dropped: no
`plan.md`.

_Trimmed at archive (2026-10-09): 15 of 22 findings were `fixed` and are removed — their record is the commit. What remains is what the gate chose not to act on._

## Findings

<!-- comment-noise-audit: 0 findings (6 comments kept). feature-first / module-cohesion /
     structure-scatter: 0 findings. code-review mutation-checked both regression specs (each fails
     without its fix). -->

- [x] 🔵 OBSERVATION · dropped · `code-review` · `src/components/kosztorys/editor/use-kosztorys-editor.ts:643` · a latched row's Lp. blanks/renumbers under „Tylko zgłoszone” (`documentRows` isn't latched) — lasts until the toggle, Lp. gutter hidden on a phone; same root as the skipped altitude finding below
      test: no automated test · — cosmetic
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `src/components/ui/dialog.tsx:75` · dialog close label follows a manager's account language — that is the app-language design
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `src/lib/kosztorys/print/worker.ts:154` · `c-ref` 16mm width — verified it fits
- [x] dismissed · `tailwind-v4-audit` · `src/lib/kosztorys/print/worker.ts:169` · `c-unit` in the extras table — it really is the unit column
- [x] skipped · `simplify` · `src/components/kosztorys/editor/kosztorys-editor-body.tsx:340` · `&& !reportedOnly` exists because „Tylko zgłoszone” is modelled as a document condition, so it narrows subtotals/numbering too — the split (document vs view condition sets) changes subtotals and Lp. under the toggle and leaves an ordinal-less edge row; needs an owner call, do it only if the shifting is noticed
- [x] dropped · `simplify`/`reuse-scan` · `report-grid.test.tsx:104` + `worker-report-form.test.tsx:116` · two one-line `openOptions` helpers (sync vs async) — sharing costs what it saves
- [x] dismissed · `simplify` · `src/components/ui/dialog.tsx:52` · `useTranslation` in every dialog — one context read + a cached translator

## Simplify pass

Ran /simplify (reuse, simplification, efficiency, altitude) + primitive-reuse-scan (report-only, folded
into the reuse agent) — 13 applied, 1 skipped, 1 dropped, 1 dismissed; each finding folded into the
Findings list above (tagged `simplify` / `reuse-scan`). No separate report.

## Tests & suite

- Touched specs (25 files covering every changed module): 139 passed, 4 skipped (DB-backed spec, no DB).
- `tsc --noEmit`: clean. `eslint` on changed files: clean.
- Full suite: skipped by user (2026-10-06) — the pre-push hook runs typecheck + unit + integration.
