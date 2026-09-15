# Review-gate ledger — szablony-crud · 2026-09-14

Slice scope: `297ad5d1..3af6a728` (branch `szablony-crud`), 33 files.
Fan-out: impl-review, code-review, tailwind-v4-audit, feature-first-structure,
module-cohesion-audit, structure-scatter-audit, comment-noise-audit.
Step 0.5 (browser verification pass): skipped — no `verify-manual-checks` skill installed.

## Findings

<!-- [box] [severity, bug-finding checks only] · disposition · `source` · `file:line` · what — why -->

- [x] dropped · gate Step 3 · the browser-level path (otwórz szablon → edytuj → zapisz → warsztat zajęty przez inny szablon) gets NO E2E and NO `e2e-backlog` issue — owner's call, 2026-09-14. The obligation is discharged by decision, not by a ticket nobody would pick up; the szablon rules that could actually lose work (zapis po id, singleton warsztatu, zakres punktów przywracania) are pinned at the DB layer instead
- [x] 🔵 skipped · code-review · deploy order — the additive migration must be applied to prod BEFORE the push; already the documented human step (`pnpm db:migrate:prod`), nothing to change in code
- [x] 🔵 dropped · code-review · `kosztorys-presets.ts:96` · `renamePreset` false conflates „name taken" with „row gone" — reachable only by a delete racing a rename; both mean „nothing was renamed", not worth a second round trip
- [x] 🔵 skipped · code-review · `preset-row-actions.tsx:70` · owner-only buttons render for MANAGER — the server refuses and toasts; hiding them would mean threading the role into every row, and this mirrors how the rest of the app presents owner-only actions
- [x] 🔵 dropped · code-review · `szablony/[id]/page.tsx:22` · `notFound()` before auth for a non-numeric id — discloses nothing beyond „this route exists"
- [x] 🔵 dropped · impl-review · `collections/investments.ts:12` · `szablon` is pickable in the /admin status select — Payload's select has no per-option hide, so this needs a custom field component for an owner-only surface; the intent is documented at the option
- [x] dismissed · feature-first #4 / cohesion #2 · `lib/db/workshop-investment.ts:17` · Payload-ORM write inside the raw-SQL DAL — provisioning has to go through `payload.create` to run the collection's hooks; precedent `stamp-sequentially.ts:27`. The read/write split now makes the one ORM call the only thing in `resolveWorkshopInvestment`
- [x] dismissed · cohesion #3 · `lib/actions/kosztorys-presets.ts` · watch-for-growth on the workbench half — one more action added; still one cohesive preset-library module
- [x] dropped · comment-noise · triple-stated „szablon workbench" preamble (`investment-lock.ts:17`, `workshop-investment.ts:8`, migration:4) — each file is read alone and needs its own one-liner; deduping would leave two of the three pointing elsewhere
- [x] dismissed · tailwind-v4-audit · 0 findings attributable to this slice

- [x] dismissed · simplify · `lib/db/presets.ts:193` · `isoOrNull(…) ?? ''` — a type narrowing on a NOT NULL column, not dead defence
- [x] dismissed · simplify · `lib/kosztorys/types.ts` · narrowing the UI status maps to exclude `szablon` — the warsztat stays reachable by direct id URL, so the maps must cover it
- [x] skipped · simplify · `preset-row-actions.tsx:43` · `IconActionButton` extraction — 5 copies across two feature dirs; its own review, not this slice
- [x] skipped · simplify · `lib/cache/tags.ts` · splitting the `presets` tag — cache-correctness change, and not worth it at this library size

## Simplify pass

Ran /simplify — 12 applied, 0 proposed, 2 dismissed, 2 skipped; each finding folded into `## Findings` (tagged `simplify`).
Report: `/var/folders/cf/bs0zn0gj1lgbc2n7ps0z211h0000gn/T/simplify-XXXXXX.fsKtSQ9dFh.md`

## Tests & suite

- `pnpm typecheck` — pass.
- `eslint` + `prettier` on every touched file — clean.
- New specs, run against the isolated 5435 `db-test` (24 passed, 4 files):
  - `src/__tests__/lib/db/workshop-investment.test.ts` (new) — the warsztat is found by STATUS, not recency, and reports the szablon it holds.
  - `src/__tests__/lib/db/presets.test.ts` — `updatePresetPayload` overwrites in place by id, and resurrects nothing when the szablon was deleted while open (the upsert bug's regression guard).
  - `src/__tests__/lib/actions/kosztorys-presets.test.ts` — `saveWorkshopPresetAction` writes into the szablon the warsztat holds and refuses, writing nothing, when it holds another.
  - `src/__tests__/lib/db/snapshots.test.ts` — restore points are scoped to the szablon the warsztat holds, by list AND by id; a normal investment is untouched.
- Migrations `20260914_1` + `20260914_2` applied to the dev DB (5433) and the test DB (5435). Prod owes both, BEFORE the push (additive).
- `src/__tests__/lib/constants/investment-lock.test.ts` — 4 passed after the altitude revert.
- Full suite (`typecheck && lint && test && build`) + `test:e2e` — not run yet; awaiting the go.
- E2E: none, by owner's decision — `pnpm test:e2e` not run.
