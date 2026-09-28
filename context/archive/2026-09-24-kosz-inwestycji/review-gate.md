# Review-gate ledger — kosz-inwestycji · 2026-09-28

Diff: `bf28bb57..HEAD` (branch `kosz-inwestycji`). Step 0.5 browser pass skipped — no Playwright unprompted.
Fan-out: impl-review, code-review, tailwind-v4-audit, feature-first-structure, module-cohesion-audit,
structure-scatter-audit, comment-noise-audit.

## Findings

- [x] 🟡 WARNING · dismissed · impl-review · `src/collections/investments.ts:172` · MANAGER can PATCH `trashedAt` over REST — the Payload panel/REST path is unused and out of scope by plan; the app's actions are owner-only
- [x] 🔵 OBSERVATION · skipped · code-review · `src/lib/investments/delete-investment-forever.ts:23` · trashed check and delete not in one transaction — needs a manual Przywróć during the 03:00 cron; single owner
      test: no automated test · — race not reproducible without a scheduler hook
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/app/(payload)/api/cron/cleanup/route.ts:24` · 200 on a partial failure — explicit plan decision, log carries both results
- [x] 🔵 OBSERVATION · dropped · code-review · `src/lib/queries/trash.ts:25` · countdown may be up to a day off vs the cron — cosmetic
- [x] 🔵 OBSERVATION · filed · impl-review · e2e · listing → trash → restore → delete-forever browser flow — filed EX-874 (`e2e-backlog`)
      test: e2e — deferred into EX-874
- [x] dismissed · feature-first-structure · `src/lib/queries/trash.ts` · naming — the `/kosz` page aggregator by design
- [x] skipped · impl-review · `src/components/trash/*` · `router.refresh()` after actions may be redundant — repo precedent is split; unverifiable without the browser
- [x] dropped · code-review · `src/lib/investments/purge-trash.ts:43` · cache expiry in lib rather than the route — no second caller to warrant moving it
- [x] dropped · code-review · `src/lib/actions/investment-trash.ts:104` · three reads of the row on delete-forever — owner-only, rare
- [x] dropped · tailwind-v4-audit · — · no Tailwind lint plugin — repo-wide tooling, not this slice
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
