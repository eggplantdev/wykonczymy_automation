# Review-gate ledger — EX-1033 document-settings-column-map · 2026-10-15

Scope: `b7b62700d^..485964557` — `b7b62700d` (lesson + staging manual checks) and `485964557` (code,
migration `20261015_0`, specs); 20 files, no untracked files, none dirty in the tree.

Checks: `/10x-impl-review` (against `plan.md`), `/code-review`, comment-noise-audit (flag-only),
feature-first-structure + module-cohesion-audit + structure-scatter-audit (diff-scoped).
`tailwind-v4-audit` dropped — no markup in the diff. Step 0.5 browser pass dropped — Playwright
only on explicit ask; the staging manual checks from `b7b62700d` cover it.

## Findings

- [x] · 🟡 WARNING · fixed · `.husky/pre-push:22-44` · the prod gate said „migrate first, then push" — for `20261015_0` that is the leak order (old code reads a map as „never chosen" → hidden `price`/`net` reappear). Migrations now carry a `RUN-AFTER-DEPLOY` header marker; the gate prints „push, then migrate" for them and warns to split a mixed release. AGENTS.md Migrations updated.
      test: no automated test · e2e — deploy procedure; marker detection checked by hand against `b7b62700d^..HEAD`.
- [x] · 🟡 WARNING · fixed · `src/lib/kosztorys/columns/document-column-visibility.ts:20-24` · the legacy-array branch still read an unmentioned key as shown, so „a new default-hidden column needs no migration" held only once prod is migrated (prod is three migrations behind). Each document now passes a frozen `LEGACY_*_COLUMNS`; an array speaks only for the columns it was written against, anything newer reads as its code default. Zero behaviour change today (legacy set = current ceiling).
      test: TDD · unit — `reads a column the legacy array was not written against as its code default`.
- [x] · 🟡 WARNING · fixed · `src/migrations/20261015_0_document_settings_column_map.ts:7-11` · a rollback past EX-1033 after the migration ran serves the old code maps → leak; nothing said to run `down` first. Header and plan Migration Notes now say so.
      test: no automated test · e2e — operational.
- [x] · 🔵 OBSERVATION · fixed · `src/migrations/20261015_0_document_settings_column_map.ts:54-58` · `kosztorys_worker_view_settings.hidden_columns` kept DB default `'[]'` (reads as „hide nothing") while the Payload field now says `{}`. `up` sets `'{}'`, `down` restores `'[]'`. The investor tables have no DB default (checked) — that half of the /code-review claim was wrong.
      test: TDD · integration — `defaults a new worker row to an empty map`.
- [x] · 🔵 OBSERVATION · fixed · `src/__tests__/migrations/20261015_0_document_settings_column_map.test.ts` · no case for a NULL row staying NULL — added. The defaults table is the same loop body; not seeded.
      test: TDD · integration.
- [x] · 🔵 OBSERVATION · dismissed · `src/migrations/20261015_0_document_settings_column_map.ts:72-82` · `down` keeps only `true` keys, so a later default-hidden key would show — after the legacy-ceiling fix an array never speaks for a key added since, so it reads as its default.
      test: no automated test — covered by the legacy-ceiling unit case.
- [x] · 🔵 OBSERVATION · dismissed · `src/lib/kosztorys/columns/document-column-visibility.ts:36-42` · `toHiddenColumnMap` freezes today's defaults into saved rows — by design: a saved document is the owner's reviewed choice (plan + lesson).
- [x] · 🔵 OBSERVATION · dismissed · `src/globals/kosztorys-worker-view-settings.ts:20` · unplanned `defaultValue: [] → {}` — fails closed, an improvement; prod has the row.
- [x] · 🔵 OBSERVATION · dismissed · stale-client save after a column-adding deploy — action ids change per build; an old deployment writes an array, which the legacy ceiling now covers.
- [x] · 🔵 OBSERVATION · fixed · `context/foundation/manual-checks.md` (EX-1033 step 3) · hard-coded `object (34)`; prod now has 36 rows → „same `object`, żadnego `array`". Plan Progress 2.2 („applied locally") was true at commit time — local DB was re-imported from the 12:05 dump since; not edited.
- [x] · fixed · `src/lib/kosztorys/columns/document-column-visibility.ts:5` · `unpinnedCeiling` copied the private `unpinned()` — exported from `document-column-order.ts`, also used by `document-column-order-button.tsx:41`.
- [x] · fixed · `src/lib/kosztorys/columns/document-column-visibility.ts:25` · `null` sentinel + both `?? DEFAULT…hiddenColumns` fallbacks were derivable — a non-shape now reads as `{}` (same list, same order).
- [x] · fixed · `src/lib/kosztorys/client-view/settings.ts:44` · private `DEFAULT_HIDDEN_COLUMNS` shadowed the grid's export of the same name — renamed `CLIENT_DEFAULT_HIDDEN_COLUMNS`.
- [x] · fixed · `src/lib/kosztorys/client-view/settings.ts:25-26`, `context/foundation/lessons.md` (namespacing rule 3) · still described the stored hidden set / „a lost key reveals" — now „default hidden set" / „falls to its code default".
- [x] · fixed · comment noise (5): `document-column-visibility.test.ts:11-12` and migration `:4-5` deleted; `kosztorys-client-view.ts:8-12`, `kosztorys-worker-view-settings.ts:4-7` trimmed; `worker-view/settings.ts:44-48` back to its pre-diff text.
- [x] · dropped · `src/lib/kosztorys/{client,worker}-view/settings.ts` `toStored*` · six-line twins; a generic `(sanitize, ceiling)` helper is as long as what it replaces.
- [x] · dismissed · structure audits · placement correct, 0 scatter; flat `src/lib/kosztorys` and `WorkerViewSettingsT` outside `types.ts` predate the diff.

## Simplify pass

Folded into the fixes above (unpinned reuse, null sentinel, rename, comment trims); nothing further.

## Tests & suite
