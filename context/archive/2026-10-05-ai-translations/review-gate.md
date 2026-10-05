# Review-gate ledger — ai-translations (EX-992) · 2026-10-05

Scope: `49d1916e..2caa9179` (p1–p5 + docs, merged into `staging` as `3e0f4d53`) + `c2190810` (retranslate toast).
Step 0.5 (browser verification) skipped — the owner verifies by hand against `manual-checks.md` § EX-992.

## Findings

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
- [x] 🔵 OBSERVATION · dropped · impl-review · katalog writer „edited during the wait" case untested — the compare-and-set SQL is shared with the kosztorys writer, which is covered
      test: no automated test · — covered through the shared writer
- [x] 🔵 OBSERVATION · dropped · code-review · no number check on opis translations (only section names have one) — the owner corrects AI output by hand by decision („no review step")
      test: no automated test · — by decision
- [x] 🔵 OBSERVATION · dismissed · code-review · prompt injection through a worker's line — the manager reads the Polish before accepting; the output is only text
      test: no automated test · — no change
- [x] 🔵 OBSERVATION · dismissed · code-review · migration deploy order — `20261005_4` is additive: a human runs `pnpm db:migrate:prod` before the push, per AGENTS.md
      test: no automated test · — process gate
- [x] dismissed · tailwind-v4-audit · raw `amber` palette in the review dialog — 13 usages repo-wide, the established warning tint
- [x] dropped · module-cohesion · split `translate.ts` into three files / split the section plane out of `ai-translation-fill.ts` / rename translation-fill vs ai-translation-fill — churn without a reader win
- [x] dropped · module-cohesion · `kosztorys.ts` god module and `getSectionNames` — pre-existing, not this slice
- [x] dropped · feature-first · `translate-at-creation.test.ts` name does not mirror a source file — a cross-cutting spec, allowed at that level

- [x] skipped · simplify · `src/lib/actions/kosztorys.ts` · adding a row waits on the AI before the insert (E1) — by design: the translation is opt-in and the manager sees it on save; moving it to `after()` changes behaviour
- [x] dropped · simplify · S9 / A8 — toast and button wording; owner's call, not a cleanup
- [x] dropped · simplify · E3 / E4 / A6 — micro-costs (an extra Map, a second `trim`, one DB round-trip per fill) not worth the churn
- [x] dismissed · simplify · R6 — `catalogueTranslationsFor` mirrors its file's pattern and must stay importable from scripts
- [x] dismissed · simplify · R8 / A7 — superseded by the fixes above
- [x] dropped · reuse-scan · `fill-description-translations.ts` · hand-rolled `FROM (VALUES …)` — 12 such statements repo-wide and no helper exists; not this diff's reinvention
- [x] dismissed · reuse-scan · `FillCatalogueTranslationsButton` vs `useTreeRewriteAction` — the katalog has no tree to reseed and uses `useTransition`; contracts differ
- [x] dropped · reuse-scan · `listReportExtras` / `readPendingExtra` share a two-field row mapping — too small to name

- [x] filed · e2e · browser-level E2E owed by the slice (review dialog „Przetłumacz", the two „Uzupełnij tłumaczenia (AI)" buttons) — filed EX-995 (`e2e-backlog`)

## Simplify pass

Ran /simplify (4 agents) + primitive-reuse-scan — 12 applied, 1 skipped, 5 dropped, 3 dismissed; each finding folded into ## Findings (tagged simplify / reuse-scan).

## Tests & suite

- Whole-tree gate run before the review (implement phase): typecheck ✓, lint ✓ (0 errors), `pnpm test` 2 failed / 5044 passed (`row-content-lines.test.ts` — clip cue for `descriptionTranslation__uk` / `__ru`), `pnpm test:integration` 1 failed / 624 passed (`payout-without-stages.test.ts`).
- After the review fixes, specs run singly (suite not rerun): unit — `ai-translation-fill` 7, `description-translations` 14, `notice` 4, `translate` 6, `openrouter-fallback` 5; DB (5435) — `kosztorys-translations` 1, `translate-at-creation` 7, `worker-report-translation` 6, `accept-worker-report` 26, `worker-reports` 10, `kosztorys-item-texts.db` 4, `section-translations.db` 1, `worker-report` 8, `work-catalogue-translations` 1; DOM — `clean-item-texts-action` 1. All green. typecheck ✓ (only stale `.next-e2e` validator noise), eslint 0 errors.
