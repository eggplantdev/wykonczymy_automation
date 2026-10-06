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

## Findings

<!-- comment-noise-audit: 0 findings (6 comments kept). feature-first / module-cohesion /
     structure-scatter: 0 findings. code-review mutation-checked both regression specs (each fails
     without its fix). -->

- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/components/ui/confirm-dialog.tsx:50` · cancel label hardcoded „Anuluj”, so a uk/ru worker's „Wyślij” confirm showed Polish — default is now `t('cancel')` from `common`; drops `send-bar`'s per-caller override
      test: TDD · unit (dom) — `__tests__/components/ui/confirm-dialog.test.tsx`, red on the uk provider before the fix
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/components/users/worker-investments-section.tsx:41` · the `canReport` gate (report link only on the worker's own page) had no guard
      test: TDD · unit (dom) — `__tests__/components/users/worker-investments-section.test.tsx`, link present / withheld
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/lib/i18n/dictionaries/pl.ts:92` · „musisz być przypisany do któregoś z etapów inwestycji” was false for a worker assigned only on closed investments — now „…aktywnej inwestycji” (pl/ru/uk, both notices, manual-checks wording synced)
      test: no automated test · — copy change, no logic
- [x] 🔵 OBSERVATION · fixed · `code-review` · `context/changes/2026-10-01-ai-kosztorys-generation-tests/cases/01-bemowo-125m2/owner-comparison.md:14` · `compare-owner.py` compares Przedmiar × Cena with no rabat and wrote a stray `compare.json` — caveat added (#168 has no rabat; #175 not checkable locally), JSON dump removed
      test: no automated test · — one-off analysis script, re-run output checked by hand
- [x] 🔵 OBSERVATION · dropped · `code-review` · `src/components/kosztorys/editor/use-kosztorys-editor.ts:643` · a latched row's Lp. blanks/renumbers under „Tylko zgłoszone” (`documentRows` isn't latched) — lasts until the toggle, Lp. gutter hidden on a phone; same root as the skipped altitude finding below
      test: no automated test · — cosmetic
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `src/components/ui/dialog.tsx:75` · dialog close label follows a manager's account language — that is the app-language design
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `src/lib/kosztorys/print/worker.ts:154` · `c-ref` 16mm width — verified it fits
- [x] fixed · `suite` · `src/__tests__/components/kosztorys/worker-report/worker-report-form.test.tsx:126` · „Wszystkie prace (+1)” spec failing at HEAD since 9be15737 moved the counters into „Opcje” — opens the menu first
- [x] dismissed · `tailwind-v4-audit` · `src/lib/kosztorys/print/worker.ts:169` · `c-unit` in the extras table — it really is the unit column
- [x] fixed · `simplify` · `src/lib/kosztorys/problem-conditions.ts:83` · latch rule was an inline `preview ? (reportedOnly ? … : ∅) : engagedProblemIds(…)` special case beside the module that claims to own it — now `engagedLatchingIds` (problems + `report-unreported`), behaviour-identical (preview never engages a problem)
- [x] fixed · `simplify` · `src/components/ui/row-actions/delete-button.tsx:18` · per-caller `label={t('delete')}` on the expense-draft delete vs the primitive-localizes pattern — `DeleteButton` defaults to `common.delete` (new key, pl/ru/uk)
- [x] fixed · `simplify`/`reuse-scan` · `src/components/ui/dialog-actions.tsx:38` · sibling of `ConfirmDialog` still hardcoded „Anuluj” — same `cancelLabel ?? t('cancel')`
- [x] fixed · `simplify` · `src/lib/kosztorys/format.ts:26` · three conventions for a missing unit (`|| 'bez j.m.'` ×5, bracket-less in the swap dialog, „()” in `worker-report-review.tsx:145`) — one `unitLabel`, 7 sites
- [x] fixed · `simplify`/`reuse-scan` · `src/__tests__/helpers/kosztorys-undo-redo.ts` · `UndoRedoApiT` stub copied into 3 specs — `stackUndoRedo()` helper
- [x] fixed · `simplify`/`reuse-scan` · `src/__tests__/helpers/worker-audience.ts` · `WorkerAudienceT` fixture copied into 5 specs — `workerAudience(summaryOverrides)` helper
- [x] fixed · `simplify` · `src/components/users/worker-investments-section.tsx:41` · report cell nested two levels under `canReport` — extracted `ReportLinkCell`
- [x] fixed · `simplify` · `src/__tests__/components/kosztorys/worker-report/worker-report-form.test.tsx:77` · „Tylko zgłaszane” absence assertion vacuous since the menu move — now opens „Opcje” first
- [x] fixed · `simplify` · `src/components/forms/investment-form/investment-form.tsx:103` · `cancelLabel: 'Anuluj'` restated the default
- [x] fixed · `simplify` · `context/changes/2026-10-01-ai-kosztorys-generation-tests/cases/01-bemowo-125m2/scripts/compare-owner.py` · dead fields (`notes`/`parts`/`n`, `tplp`, `*_only_row`, `*_note`) — output byte-identical after
- [x] skipped · `simplify` · `src/components/kosztorys/editor/kosztorys-editor-body.tsx:340` · `&& !reportedOnly` exists because „Tylko zgłoszone” is modelled as a document condition, so it narrows subtotals/numbering too — the split (document vs view condition sets) changes subtotals and Lp. under the toggle and leaves an ordinal-less edge row; needs an owner call, do it only if the shifting is noticed
- [x] dropped · `simplify`/`reuse-scan` · `report-grid.test.tsx:104` + `worker-report-form.test.tsx:116` · two one-line `openOptions` helpers (sync vs async) — sharing costs what it saves
- [x] dismissed · `simplify` · `src/components/ui/dialog.tsx:52` · `useTranslation` in every dialog — one context read + a cached translator

## Simplify pass

Ran /simplify (reuse, simplification, efficiency, altitude) + primitive-reuse-scan (report-only, folded
into the reuse agent) — 13 applied, 1 skipped, 1 dropped, 1 dismissed; each finding folded into

## Findings (tagged `simplify` / `reuse-scan`). No separate report.

## Tests & suite

- Touched specs (25 files covering every changed module): 139 passed, 4 skipped (DB-backed spec, no DB).
- `tsc --noEmit`: clean. `eslint` on changed files: clean.
- Full suite: skipped by user (2026-10-06) — the pre-push hook runs typecheck + unit + integration.
