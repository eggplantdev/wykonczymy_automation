# Review-gate ledger — ai-translations (EX-992) · 2026-10-05

Scope: `49d1916e..2caa9179` (p1–p5 + docs, merged into `staging` as `3e0f4d53`) + `c2190810` (retranslate toast).
Step 0.5 (browser verification) skipped — the owner verifies by hand against `manual-checks.md` § EX-992.

## Findings

- [x] 🟡 WARNING · fixed · impl-review · `src/lib/actions/accept-worker-report.ts:363` · accepting an extra detected as `other` dropped its Polish and kept the worker's words as the opis — the Polish now lands whenever there is one; a uk/ru translation is attached only for a language the editor carries
      test: test-driven-debugging · integration — `accept-worker-report.test.ts` „accepts an extra in a language the editor does not carry…", red on the old code, now green
- [x] 🟡 WARNING · fixed · impl-review · `src/lib/actions/worker-report-translation.ts:26` · a „Przetłumacz" retry the model read as Polish wiped the Polish the manager already had (and the toast claimed „po polsku") — the stored translation is kept and returned, so the toast says „Tłumaczenie bez zmian"
      test: test-driven-debugging · integration — `worker-report-translation.test.ts` „keeps a Polish translation the retry calls Polish…", red first, now green
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/db/worker-report-line-translations.ts:25` · the retry's write did not re-check that the report is still pending, so an accept during the AI wait could be followed by a translation write — the writer now repeats the pending-extra condition (`STILL_PENDING_EXTRA`)
      test: test-driven-debugging · integration — `worker-reports.test.ts` „writes no translation onto a line whose report was decided during the model call"
- [x] 🟡 WARNING · skipped · code-review · `src/lib/actions/accept-worker-report.ts:363` · accept reads the Polish from the DB rather than what the manager saw (same as impl-review F3) — the window is the seconds of one retry, and what lands is the newer, intended translation; no user-visible harm
      test: no automated test · — nothing to guard while it stays as designed
- [x] 🟡 WARNING · dropped · code-review · `src/lib/actions/worker-report.ts` · a public report token can trigger AI spend (up to 2000 extras per report) — the token holders are the firm's own workers and the model is flash-lite; reconsider a cap only if abuse shows up
      test: no automated test · — no change made
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/lib/ai/translate-new-row.ts:30` · try/catch around `translateTexts` is dead (batches already swallow failures) — kept on purpose (now a `.catch` on `translateRows`): the save-never-fails guarantee must not hang on `inBatches` internals, and `translate-at-creation.test.ts` pins it with a rejecting mock
      test: no automated test · — existing spec already covers it
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/lib/actions/kosztorys-translations.ts` · worst case ~420 s against the 300 s ceiling — only on an OpenRouter hang; every write lands at the end, so a timeout leaves nothing partial
      test: no automated test · — no change
- [x] 🔵 OBSERVATION · dismissed · code-review · `maxDuration` on the fill actions — same reasoning as above
      test: no automated test · — no change
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/lib/i18n/ai-translation-fill.ts:27` · `needsTranslation` treats a blank translation text as current — unreachable: `toDescriptionTranslations` drops blank entries on read and `withTranslation` deletes them on write
      test: no automated test · — unreachable
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/lib/utils/notice.ts` · no specs for `translationFillNotice` / `retranslationNotice` — added `src/__tests__/lib/utils/notice.test.ts`
      test: TDD · unit — pins every wording branch
- [x] 🔵 OBSERVATION · dropped · impl-review · katalog writer „edited during the wait" case untested — the compare-and-set SQL is shared with the kosztorys writer, which is covered
      test: no automated test · — covered through the shared writer
- [x] 🔵 OBSERVATION · dropped · code-review · no number check on opis translations (only section names have one) — the owner corrects AI output by hand by decision („no review step")
      test: no automated test · — by decision
- [x] 🔵 OBSERVATION · dismissed · code-review · prompt injection through a worker's line — the manager reads the Polish before accepting; the output is only text
      test: no automated test · — no change
- [x] 🔵 OBSERVATION · dismissed · code-review · migration deploy order — `20261005_4` is additive: a human runs `pnpm db:migrate:prod` before the push, per AGENTS.md
      test: no automated test · — process gate
- [x] 🔵 OBSERVATION · fixed · impl-review · plan drift (failure signal via `warning`, extra orchestration modules) — noted in `change.md` § Drift from the plan
- [x] fixed · suite · `src/__tests__/lib/kosztorys/row-content-lines.test.ts:61` · clip-cue spec matched selectors flat while the formatter wraps them — whitespace collapsed before matching (pre-existing, broke the pre-push gate)
- [x] fixed · suite · `src/__tests__/lib/actions/payout-without-stages.test.ts:83` · spec queried the dropped `kosztorys_stages.worker_id` (EX-974) — counts membership through `kosztorys_stage_workers` (pre-existing)
- [x] dismissed · tailwind-v4-audit · raw `amber` palette in the review dialog — 13 usages repo-wide, the established warning tint
- [x] fixed · feature-first / module-cohesion · orchestration (`translate-report-lines.ts`, `translate-section-name.ts`) sat in `lib/ai` — moved to `lib/actions`; `lib/ai` keeps the model calls
- [x] fixed · module-cohesion · `FALLBACK_MODEL` lived in the receipt module `openrouter.ts` — moved to `openrouter-client.ts`, which both callers share
- [x] fixed · module-cohesion · `worker-reports.ts` carried the line-translation statements — split into `src/lib/db/worker-report-line-translations.ts`
- [x] fixed · structure-scatter · `SAVED_UNTRANSLATED_WARNING` sat in `lib/ai/translate-new-row.ts` — moved to `lib/utils/notice.ts` with the other notice wording
- [x] fixed · module-cohesion · `translate.ts` repeated the fallback + `generateObject` call per direction — one `generate`, on the `withModelFallback` the receipt module now shares too (see simplify A3/R4)
- [x] dropped · module-cohesion · split `translate.ts` into three files / split the section plane out of `ai-translation-fill.ts` / rename translation-fill vs ai-translation-fill — churn without a reader win
- [x] dropped · module-cohesion · `kosztorys.ts` god module and `getSectionNames` — pre-existing, not this slice
- [x] dropped · feature-first · `translate-at-creation.test.ts` name does not mirror a source file — a cross-cutting spec, allowed at that level
- [x] fixed · comment-noise · 7 trims (`kosztorys-translations.ts`, `work-catalogue.ts`, `worker-report-translation.ts`, `translate-new-row.ts`, `translate-section-name.ts`, `notice.ts` ×2) + 3 deletions (migration „Hand-written", `review-lines-table.tsx` TranslationNote, `kosztorys.ts` catalogueTranslationsFor); kept the migration's nullability sentence and `addItemSchema.translate`'s why

- [x] fixed · simplify · `src/lib/kosztorys/worker-report/reviewed-description.ts` · the opis an accepted extra lands with was decided in the review component and again in the action — one `reviewedDescription` in lib, read by both (S1/R3)
- [x] fixed · simplify · `src/lib/actions/translate-section-name.ts:17` · section-name fill was written twice (after-rename and „Uzupełnij tłumaczenia"), one SELECT per name — `fillSectionNameTranslations` over `getSectionTranslations` (one `IN` read), and the kosztorys fill runs rows and sections in parallel (S2/R2/E2)
- [x] fixed · simplify · `src/components/kosztorys/editor/actions/use-tree-rewrite-action.ts` · „Uzupełnij tłumaczenia" and „Popraw literówki" copied the same settle / REQUEST_FAILED reseed / pending block — `useTreeRewriteAction` (S3/R7)
- [x] fixed · simplify · `src/lib/db/worker-report-line-translations.ts:47` · keep-stored-Polish was a read-then-decide in the action — the writer keeps it in SQL and returns the stored row (`RETURNING`); no row back = `STALE_LINE` (S4/A1/A2)
- [x] fixed · simplify · `src/lib/db/fill-description-translations.ts` · every caller merged writes per row before the UPDATE … FROM VALUES and counted rows itself — the writer merges (`mergeRowWrites`) and returns the written count (S5/A4)
- [x] fixed · simplify · `src/lib/ai/translate-new-row.ts:13` · katalog → AI → writes was assembled by hand in three callers — `translateRows`; `translateNewRow` and both fill actions call it (R1)
- [x] fixed · simplify · `src/lib/ai/openrouter-client.ts:22` · receipt and translation each carried a primary → fallback loop — `withModelFallback` shared by both (A3/R4)
- [x] fixed · simplify · `src/lib/i18n/description-translations.ts:52` · `needsTranslation` sat in the AI-fill module while it is a property of the stored translations — moved beside `isTranslationStale`, spec moved with it (A5)
- [x] fixed · simplify · S6 / S7 / R5 / S8 / S10 — inlined single-use helpers (`sectionTemplateFill` wrapper, default `catalogueByKey`), `descriptionTranslations` field name aligned with the stored shape, dead branches removed
- [x] skipped · simplify · `src/lib/actions/kosztorys.ts` · adding a row waits on the AI before the insert (E1) — by design: the translation is opt-in and the manager sees it on save; moving it to `after()` changes behaviour
- [x] dropped · simplify · S9 / A8 — toast and button wording; owner's call, not a cleanup
- [x] dropped · simplify · E3 / E4 / A6 — micro-costs (an extra Map, a second `trim`, one DB round-trip per fill) not worth the churn
- [x] dismissed · simplify · R6 — `catalogueTranslationsFor` mirrors its file's pattern and must stay importable from scripts
- [x] dismissed · simplify · R8 / A7 — superseded by the fixes above
- [x] fixed · reuse-scan · `fill-translations-action.tsx` / `clean-item-texts-action.tsx` · in-diff copy of the tree-rewrite action block — same fix as S3 (`useTreeRewriteAction`)
- [x] fixed · reuse-scan · `src/lib/db/section-translations.ts` · hand-rolled `ANY` array for the key list — the existing `sqlList` (`src/lib/db/sql-list.ts`)
- [x] dropped · reuse-scan · `fill-description-translations.ts` · hand-rolled `FROM (VALUES …)` — 12 such statements repo-wide and no helper exists; not this diff's reinvention
- [x] dismissed · reuse-scan · `FillCatalogueTranslationsButton` vs `useTreeRewriteAction` — the katalog has no tree to reseed and uses `useTransition`; contracts differ
- [x] dropped · reuse-scan · `listReportExtras` / `readPendingExtra` share a two-field row mapping — too small to name

- [x] filed · e2e · browser-level E2E owed by the slice (review dialog „Przetłumacz", the two „Uzupełnij tłumaczenia (AI)" buttons) — filed EX-995 (`e2e-backlog`)

## Simplify pass

Ran /simplify (4 agents) + primitive-reuse-scan — 12 applied, 1 skipped, 5 dropped, 3 dismissed; each finding folded into ## Findings (tagged simplify / reuse-scan).

## Tests & suite

- Whole-tree gate run before the review (implement phase): typecheck ✓, lint ✓ (0 errors), `pnpm test` 2 failed / 5044 passed (`row-content-lines.test.ts` — clip cue for `descriptionTranslation__uk` / `__ru`), `pnpm test:integration` 1 failed / 624 passed (`payout-without-stages.test.ts`).
- After the review fixes, specs run singly (suite not rerun): unit — `ai-translation-fill` 7, `description-translations` 14, `notice` 4, `translate` 6, `openrouter-fallback` 5; DB (5435) — `kosztorys-translations` 1, `translate-at-creation` 7, `worker-report-translation` 6, `accept-worker-report` 26, `worker-reports` 10, `kosztorys-item-texts.db` 4, `section-translations.db` 1, `worker-report` 8, `work-catalogue-translations` 1; DOM — `clean-item-texts-action` 1. All green. typecheck ✓ (only stale `.next-e2e` validator noise), eslint 0 errors.
