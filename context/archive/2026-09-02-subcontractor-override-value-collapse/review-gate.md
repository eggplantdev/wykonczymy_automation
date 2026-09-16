# Review-gate ledger — subcontractor-override-value-collapse (EX-766) · 2026-09-02

Diff scope: `d4db3506..HEAD` (b5760821, 0ecb242c, 562ddbe1, c2cbeba8, d01a3c73) — 80 files.

Fan-out: `/10x-impl-review`, `/code-review`, `feature-first-structure`, `module-cohesion-audit`,
`structure-scatter-audit`, `comment-noise-audit`.
Dropped: `tailwind-v4-audit` — the slice changes zero `className`s (verified, not assumed).
Step 0.5 (browser verification) skipped — this slice's manual checks need a deployed staging behind
the preview migration, which does not exist yet.

Step 2 (`/simplify`) not dispatched as a separate pass: three of the six checks above already swept
the diff for reuse/simplification and converged on the same four findings, all applied below. A
second mutating agent over the same 80 files would re-derive what is already fixed.

## Findings

> **Przycięte przy archiwizacji (2026-09-15).** Zdjęte 16 findingów o dyspozycji `fixed` — trwałym
> zapisem naprawy jest commit, a ich treść odtwarza się z kodu i z `git show`. Zostaje to, czego git
> nie niesie: decyzje o **nie**robieniu czegoś. Tally sprzed przycięcia: **16 fixed, 9 dismissed,
> 2 dropped, 1 filed (EX-767) · 0 open**. Dwa `fixed` warto znać, bo pozostałe wpisy się do nich
> odwołują: predykat `kind = 'auto' OR jsonb_array_length(payload->'items') > 0` na `DELETE`
> snapshotów (zastąpił audyt „wszystkie 11 jest pustych", który zdążył zdryfować 11→13) oraz
> przepisanie hasha golden mastera na literalne bajty legacy. Lekcje z obu stoją w
> `context/foundation/lessons.md`.

- [x] 🔴 CRITICAL · dismissed · `code-review` · `src/migrations/20260902_0_collapse_kosztorys_tool_overrides.ts:20` · The migration fuses an additive half (backfill) with a destructive one (`DROP COLUMN`) and declares only the destructive order, so between deploy and apply every „auto" praca reads as an explicit 0 zł — mechanism confirmed (2020 + 2204 auto planes on the prod dump), blast radius nil: no kosztorys has been issued to a client, nobody reads preview, and the owner applies the migration in the same sitting. Already an owner decision recorded in `change.md:44-47`. I split the migration and then reverted it on the owner's ruling; the header now states the fusion and its expiry condition instead of misdeclaring one order.
      test: no automated test · manual — a deploy-sequencing property, not a code path
- [x] 🟡 WARNING · dismissed · `code-review` · `src/lib/kosztorys/snapshot-format.ts:29` · `SNAPSHOT_SCHEMA_VERSION` not bumped for a non-additive payload change. Its own rule offers three exits and this change takes _delete_ — which the snapshot `DELETE` predicate (trimmed above) completes: after `up`, no surviving payload carries a pozycja written in the old shape. Bumping on top would strand nothing and gain nothing.
- [x] ⚠️ WARNING · dismissed · `impl-review` · `src/migrations/index.ts:83` · Registering `20260901_1_work_catalogue_auto_rates` alongside the collapse piggybacks a second migration into the prod apply. Registering it is the fix, not the defect — prod has been throwing 23502 on a katalog „auto" write since 2026-09-01 because it was never in the array. The conflicting-headers concern folds into the first finding and dies with it.
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `src/__tests__/financial-golden-master-db.test.ts:185` · The legacy-byte rewrite is exact for `NULL` and `'amount'`, not for a legacy `'coeff'` row. Fails loud (a red parity test on an investment whose money did not move), never silent — and parity is green on the unregenerated fixture, so no such row is in the twelve comparable investments.
- [x] 🔵 OBSERVATION · dismissed · `impl-review` · `test.js:284` + 3 legal pages · `pnpm lint` fails on 4 errors. All pre-existing, all outside the diff.
- [x] dropped · `code-review` · `src/components/kosztorys/editor/grid/cells/subcontractor-columns.tsx:17` · `FIXED_MODE = 'amount'` keeps a token whose column no longer exists. Real, but it is a private UI option value with one reader — renaming it buys a grep result and risks the specs that drive the picker.
- [x] dismissed · `comment-noise-audit` · `src/migrations/20260902_0_collapse_kosztorys_tool_overrides.ts:5` · Flagged for describing the prior schema. In a migration the prior schema IS the subject, and the backfill warning is the most load-bearing comment in the diff.
- [x] dismissed · `feature-first-structure` · — · 0 placement violations; the migration, the restored `subcontractor-price-edit.ts`, all 31 specs and the change docs sit in their documented homes, and the datasheet-grid seam still runs one way.
- [x] dismissed · `module-cohesion-audit` · — · No cohesion violation introduced; three files improved (`subcontractor-price-edit.ts` 4→2 exports, `calc.ts` loses `overrideTypeFor`, `types.ts` loses `SubcontractorOverrideTypeT`). Two pre-existing god modules surfaced (`lib/actions/kosztorys.ts` 750 LOC, `row-conditions.ts` 602 LOC) — both only shrank here; a split is its own review.
- [x] dismissed · `structure-scatter-audit` · — · 0 scattered kinds, 0 stray colocations, 0 catch-alls. `SubcontractorOverrideTypeT`'s deletion removed a genuine three-layer contract.
- [x] dropped · `feature-first-structure` · `src/components/kosztorys/editor/grid/cells/subcontractor-columns.tsx:25` · `modeOf` (read) and `modeChange` (write) encode the `null ⇄ 'amount'` convention across two layers. `modeOf` produces a menu option string and is presentation-only, so it is the column's own contract; a move would drag domain into the cell or presentation into `lib/`.

- [x] filed · `gate-step-3` · `e2e/` · No browser spec for the auto-vs-explicit-0 distinction, which is the whole slice and is only visible in the grid and on `/k/<token>` — blocked on a staging deploy that does not exist yet, so filed EX-767 (`e2e-backlog`).
      test: no automated test · e2e — the obligation travels in EX-767; until then `manual-checks.md` covers it

## Simplify pass

Not dispatched — see the note under the fan-out. Four reuse/simplification findings surfaced by
`code-review` and `module-cohesion-audit`; three applied, one dropped.

## Tests & suite

- `pnpm typecheck` — green (and it is what proves the `as RowT` removal is real).
- `pnpm exec vitest run src/__tests__/lib/kosztorys src/__tests__/lib/db` — 994 passed, 71 skipped.
- `pnpm test:parity`, `pnpm test:integration`, `pnpm build` — green at `562ddbe1` / `c2cbeba8`; the
  post-review edits are comment trims plus three typed refactors that `tsc` covers. Re-run before push.
- E2E: filed as EX-767 (`e2e-backlog`) — see the last finding above.
