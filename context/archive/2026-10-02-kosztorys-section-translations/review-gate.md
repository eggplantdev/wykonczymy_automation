# Review-gate ledger — kosztorys-section-translations (EX-965) · 2026-10-02

Base: `staging` (merge-base `39bc9b1b`), branch `kosztorys-section-translations`, 4 commits.
Step 0.5 (browser verification pass) skipped — Playwright runs only on an explicit ask; the 8 manual
checks stay in `context/foundation/manual-checks.md` § EX-965.

## Findings

<!-- `review` = the first fan-out (impl-review, code-review and the structure/comment audits). Its per-check source tags and native severities were lost in a context reset, so they are not reconstructed here. -->

- [x] skipped · review · `src/lib/i18n/section-translations.ts:16` · ordinals and numbers glued to units („2-piętro", „230V") are text, not placeholders — changing that changes the keying rule, and none of the 25 live section names hit it (unreachable today)
      test: no automated test · — skipped with no behaviour change
- [x] dismissed · review · `src/lib/queries/section-translations.ts` · a missing table would 500 the worker page — the migration ships in the same change and the table exists wherever the code runs
- [x] skipped · review · `section-translation-dialog.tsx` · keyboard focus inside the dialog vs the grid's key handling was not automated — added as a manual check in `manual-checks.md` § EX-965
      test: no automated test · — manual check
- [x] filed · review · worker report link · the browser path (manager translates → worker sees a Ukrainian section name) has no E2E — filed EX-977 (`e2e-backlog`)
      test: TDD · e2e — owed in EX-977
- [x] dropped · review · plan Phase 1 manual DB check · covered by the seed-key spec plus the migration applied on the test DB
- [x] dismissed · review · `translate-tree.ts:13` · the comment carries the reason section names bypass `descriptionTranslations`
- [x] dismissed · simplify · `use-load-on-open.ts:6` · `LoadResultT` looks like a copy of `ActionResultT`, but `ActionResultT` is a conditional type that blocks inferring `T`
- [x] dismissed · simplify · `section-translations.ts:5` · `SectionTranslationsT` has the same shape as `TranslationTextsT` but means stored `#` templates, not typed text
- [x] dropped · simplify · `use-load-on-open.ts` vs `use-list-on-open.ts` · merging them needs an `onFail` param plus a `reset`, about as long as what it replaces, and the failure contracts differ
- [x] dropped · simplify · `section-translations-endpoint.ts:16` · a `perTranslationLanguage` helper for two `Object.fromEntries` casts — borderline, not worth the churn
- [x] dropped · simplify · `section-translations.ts:42` · the typed-text `#` check is a substring test, while placeholders are whole tokens — a whole-token check would accept `Ванна#`; harmless either way
- [x] dismissed · simplify (efficiency) · whole diff · no waste at this scale: a cached read in an existing `Promise.all`, about 25 rows, memoised by the compiler

## Simplify pass

Ran /simplify with 4 agents (reuse, simplification, efficiency, altitude): 4 applied, 0 proposed, 6 dismissed or dropped. Each finding is folded into ## Findings (tagged `simplify`).

## Tests & suite

- Touched specs: 4 files / 28 tests green (`section-translations` unit, action DB, db DB, translate-tree), on the 5435 test DB.
- Prettier + eslint clean on the touched files. `tsc` clean apart from the worktree `importMap.js` noise.
- Fast legs (2026-10-02):
  - `pnpm typecheck`: clean apart from 3 × missing `importMap.js`, which is generated and absent in the worktree.
  - `pnpm lint`: 0 errors (82 pre-existing warnings).
  - `pnpm test`: 459 files / 4817 tests passed, 114 files skipped (DB-gated).
- Integration, build and E2E were not run, by the user's choice (E2E owed in EX-977).
- Archive blocked: the § EX-965 manual checks in `context/foundation/manual-checks.md` are still unticked.
