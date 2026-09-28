# Review-gate ledger — kosz-inwestycji · 2026-09-28

Diff: `bf28bb57..HEAD` (branch `kosz-inwestycji`). Step 0.5 browser pass skipped — no Playwright unprompted.
Fan-out: impl-review, code-review, tailwind-v4-audit, feature-first-structure, module-cohesion-audit,
structure-scatter-audit, comment-noise-audit.

## Findings

- [x] 🟡 WARNING · dismissed · impl-review · `src/collections/investments.ts:172` · MANAGER can PATCH `trashedAt` over REST — the Payload panel/REST path is unused and out of scope by plan; the app's actions are owner-only
- [x] 🔵 OBSERVATION · fixed · code-review/impl-review · `src/lib/investments/delete-investment-forever.ts:23` · a DB throw in `findByID` read as „not trashed" — moved inside the `try`; now `reason: 'error'`
      test: test-driven-debugging · unit — `delete-investment-forever.test.ts` red on the old code, green after
- [x] 🔵 OBSERVATION · fixed · code-review/impl-review · `src/lib/actions/investment-trash.ts:32` · trash-vs-transfer race undocumented — comment states the READ COMMITTED window and why it is accepted
      test: no automated test · — accepted race, delete re-counts and refuses
- [x] 🔵 OBSERVATION · skipped · code-review · `src/lib/investments/delete-investment-forever.ts:23` · trashed check and delete not in one transaction — needs a manual Przywróć during the 03:00 cron; single owner
      test: no automated test · — race not reproducible without a scheduler hook
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/app/(payload)/api/cron/cleanup/route.ts:24` · 200 on a partial failure — explicit plan decision, log carries both results
- [x] 🔵 OBSERVATION · dropped · code-review · `src/lib/queries/trash.ts:25` · countdown may be up to a day off vs the cron — cosmetic
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/lib/db/delete-blocker.ts:1` · `lib/actions` imported from `hooks/` — blocker core moved to `lib/db/delete-blocker.ts`, investment rule to `lib/investments/delete-blocker.ts`
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/lib/investments/delete-investment-forever.ts:1` · docblock overclaimed „the one way out of the DB" — sentence removed
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/lib/constants/investment-lock.ts:12` · lock docblock ignored the trash — reworded
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/components/trash/trashed-investment-actions.tsx:34` · „Usuń" clickable while a transition runs — `disabled={pending}`
- [x] 🔵 OBSERVATION · filed · impl-review · e2e · listing → trash → restore → delete-forever browser flow — filed EX-874 (`e2e-backlog`)
      test: e2e — deferred into EX-874
- [x] fixed · feature-first-structure · `src/lib/constants/investment-lock.ts:9` · `TRASH_RETENTION_DAYS` lived in `lib/db` — moved to constants; importers updated
- [x] fixed · structure-scatter-audit · `src/lib/cache/tags.ts:41` · local `entityOpts` duplicated `investmentAssetTags` — renamed to `investmentEntityOpts`, shared by all writers
- [x] fixed · module-cohesion-audit · `src/lib/cache/tags.ts:63` · trash tags listed readers already keyed on `investments` — trimmed to `['investments']`
- [x] fixed · module-cohesion-audit · `src/lib/queries/trash.ts:12` · `TrashedInvestmentT` re-declared the row type — now `TrashedInvestmentRowT & { daysLeft }`
- [x] dismissed · feature-first-structure · `src/lib/queries/trash.ts` · naming — the `/kosz` page aggregator by design
- [x] skipped · impl-review · `src/components/trash/*` · `router.refresh()` after actions may be redundant — repo precedent is split; unverifiable without the browser
- [x] dropped · code-review · `src/lib/investments/purge-trash.ts:43` · cache expiry in lib rather than the route — no second caller to warrant moving it
- [x] dropped · code-review · `src/lib/actions/investment-trash.ts:104` · three reads of the row on delete-forever — owner-only, rare
- [x] dropped · tailwind-v4-audit · — · no Tailwind lint plugin — repo-wide tooling, not this slice
- [x] fixed · comment-noise-audit · diff-wide · restating comments deleted (`investment-gate.test.ts` top, FK-cascade note, above `DeleteForeverDialog`), docblocks trimmed (`investment-gate.ts`, cron route)
- [x] fixed · comment-noise-audit · `src/lib/queries/reference-data.ts:64` · comment claimed the predicate covered the kosztorys pages — corrected
- [x] fixed · comment-noise-audit · `src/lib/actions/investment-action.ts:29` · JSDoc said status only — now names the trash marker
- [x] fixed · simplify · `src/lib/investments/purge-trash.ts:25` · `purged` counter duplicated `purgedIds.length` — derived at return
- [x] fixed · simplify · `src/lib/actions/investment-trash.ts:57` · `context` on the in-transaction update repeated `req.context` — removed
- [x] fixed · simplify · `src/lib/queries/trash.ts:14` · `daysLeft: null` duplicated `isKosztorysUsed` — `daysLeft` always a number, list branches on the flag
- [x] fixed · simplify · `src/components/trash/trashed-investments-list.tsx:10` · inline „dzień/dni" ternary — reuses `daysLabel`
- [x] fixed · simplify · `src/app/(payload)/api/cron/cleanup/route.ts:24` · `threw === 2` hard-coded the step count — compares to `steps.length`
- [x] fixed · simplify · `src/__tests__/helpers/investment.ts` · `trashDaysAgo` copied in two DB specs with literal 31/29 — shared helper + `PAST_/WITHIN_RETENTION_DAYS`
- [x] dropped · simplify · `src/components/trash/delete-forever-dialog.tsx:54` · name check written on client and server — a helper would be as long as the comparison
- [x] dropped · simplify · `src/lib/actions/investment-trash.ts:112` · action re-checks `trashedAt` the helper also checks — the read stays for the name; only one line and a better message at stake
- [x] dropped · simplify · `src/lib/actions/investment-trash.ts:57` · `payload.update` without `depth: 0` populates unused `assets` — 0 of 33 actions pass it; rare owner action
- [x] dropped · simplify · `src/app/(payload)/api/cron/cleanup/route.ts:22` · steps run sequentially — daily cron, nobody waits

## Simplify pass

Ran /simplify (reuse + primitive-reuse-scan, simplification, efficiency, altitude) — 6 applied, 0 proposed, 4 dropped; each finding folded into ## Findings (tagged simplify).

## Tests & suite

- typecheck — clean
- lint — 0 errors; no warnings in the slice's files (82 pre-existing repo-wide)
- `pnpm test` — 4076 passed, 3 failed: `kosztorys-editor-toolbar.test.tsx` (useCurrentUser outside provider), identical failures on base `bf28bb57`, unrelated
- `pnpm test:integration` — 75 files / 351 tests passed
- e2e — not run (never unprompted); flow filed as EX-874
- build — skipped (typecheck + tests cover the diff; no config change)
