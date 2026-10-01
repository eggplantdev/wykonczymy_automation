# Review-gate ledger — kosz-floty-i-sprzetu · 2026-10-01

Scope: `cc07411e..12893cc3` on `staging` (p1–p4 + epilogue), 61 files. Step 0.5 (browser
verification) skipped — no Playwright driving without an explicit ask; manual checks live in
`context/foundation/manual-checks.md` § EX-915/916.

## Findings

- [x] 🟡 WARNING · fixed · impl-review · `src/lib/actions/fleet.ts:27` · the clash check normalized the plate, but create/update wrote it as typed — a direct action call could store „ab123" beside „AB123" (the unique index is case-sensitive). Normalization moved into `vehicleSchema` (`trim().toUpperCase()`), so the check and the write read one value
      test: test-driven-debugging · integration — `fleet-duplicate-registration.db.test.ts` „stores the plate the way the clash check reads it", red before the fix
- [x] 🟡 WARNING · fixed · impl-review (same mechanism, found while fixing the above) · `src/lib/actions/equipment.ts:19` · serial trimmed for the check, stored untrimmed. `equipmentDataShape.serialNumber` now `.trim()`
      test: test-driven-debugging · integration — `equipment-duplicate-serial.db.test.ts` „stores the serial the way the clash check reads it", red before the fix
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/lib/actions/fleet.ts` / `equipment.ts` · check-then-write race on plate/serial — the unique index still refuses the second write; two people adding the same car in the same second is not a scenario at 5 users
- [x] 🔵 OBSERVATION · skipped · code-review · `src/lib/fleet/delete-vehicle-forever.ts`, `src/lib/equipment/delete-equipment-forever.ts` · delete forever / purge leaves attachment media rows + Blob files orphaned — out of scope by plan (`kosz-plikow`), 0 attachments today
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/workers/delete-blocker.ts` · worker blocker + warehouse guard count events of trashed items — plan decision „Worker trash vs item history: Unchanged" (RESTRICT FK would refuse the hard delete otherwise)
- [x] 🔵 OBSERVATION · dropped · code-review · `src/lib/queries/fleet.ts` · `loadFleetDataset` reads trashed cars' inspections under the 5000 cap — tens of rows, negligible
- [x] fixed · impl-review · `src/components/trash/trash-row-button.tsx:15` · `failed` prop dead (`FailureT.error` is a required string, so `res.error ?? failed` never fell through) — removed from props, 4 call sites, spec
- [x] fixed · impl-review + structure-scatter-audit · `src/lib/queries/trash.ts:21` · `makeModel` imported cross-domain from `lib/equipment/rows` for vehicle rows — promoted to `src/lib/utils/make-model.ts`, 4 importers updated
- [x] fixed · structure-scatter-audit · `src/components/tables/users.tsx:20` · `describeWorkerTrash` helper inside a columns file while fleet/equipment have `lib/<domain>/describe-trash.ts` — moved to `src/lib/workers/describe-trash.ts` + unit spec for the kasa/kasy branch
- [x] dropped · structure-scatter-audit · `src/components/tables/cash-registers.tsx:72` · kasa trash description inline — a constant sentence with no logic; a file for one template literal is churn
- [x] dismissed · structure-scatter-audit · `src/lib/fleet/*`, `src/lib/equipment/*` · near-duplicate per-kind trash/restore/delete/purge files — the established per-kind convention (kasa, pracownik)
- [x] dismissed · impl-review · shared plate/serial clash helper — params ≈ the code, no win
- [x] dismissed · comment-noise-audit · „no refusal" comments in the trash actions and „Hand-written" in the migration — rationale / repo convention, kept
- [x] dropped · comment-noise-audit · copied „wrapper expires the tags once" / „Route Handler context" comments in the new actions and cron steps — mirror the sibling kinds; trimming only here would make the kinds read differently
- [x] dismissed · tailwind-v4-audit, module-cohesion-audit · clean
- [x] fixed · simplify (reuse) · `src/lib/db/equipment-trash.ts` · hand-rolled `String(x ?? '')` coercion — now `text()` from `lib/db/row-coerce`
- [x] fixed · simplify (reuse) · `src/components/presets/preset-row-actions.tsx` · a third copy of the trash button (own `ConfirmDialog` + state + toast) — now renders `TrashRowButton`
- [x] fixed · simplify · `src/components/trash/trash-kinds.ts`, `delete-forever-dialog.tsx`, `trash-investment-button.tsx`, `lib/constants/trash.ts` · the same dead `res.error ?? fallback` copy as `failed` — `failed` dropped from `TRASH_KINDS`, `INVESTMENT_DELETE_FAILED_MESSAGE` deleted
- [x] fixed · simplify · `src/lib/db/equipment.ts` · `trashed_at IS NULL` repeated in 3 queries — one filter in `OVERVIEW_JOINS`' `FROM`, so a new query over it cannot forget it
- [x] fixed · simplify · `src/lib/queries/trash.ts` · six kinds each spelled out `id/trashedAt/daysLeft/autoPurges/hasSheet/pairedRegisters` — one `base(row)`, kinds add only their overrides
- [x] fixed · simplify · `src/app/(payload)/api/cron/cleanup/route.ts` · step results listed twice (status + body) — one `results` object
- [x] fixed · simplify · `src/lib/{fleet,equipment,cash-registers}/delete-*-forever.ts` · `req?: PayloadRequest` param no caller passed — removed
- [x] fixed · simplify · `delete-vehicle-forever.ts`, `delete-equipment-forever.ts` · `*_NOT_TRASHED_MESSAGE` exported, read nowhere else — un-exported
- [x] skipped · simplify · `src/lib/actions/{fleet,equipment}.ts` · generic `setTrashedAt(collection, id, date)` — keeps the per-kind convention every other kind follows; one shared helper for two kinds only is a review-worthy refactor across all six
- [x] skipped · simplify (altitude) · `src/lib/queries/trash.ts`, `trash-section.tsx` · fold the worker's `pairedRegisters` into `detail` — moves „razem z kasą…" above „W koszu od…" (visible change) and reshapes EX-918's row; not this slice's call
- [x] dismissed · simplify (altitude) · `equipment-schema.ts` / `collections/equipment.ts:30` · serial `'' → null` in three places — the collection hook is already the deepest layer and covers every writer incl. /admin; the schema's `.trim()` only feeds it
- [x] filed · simplify (altitude) · `src/lib/actions/workers.ts:6` · a trashed worker's e-mail gives the generic error, not „jest w Koszu — przywróć go stamtąd" like plate/serial — EX-918's area, behaviour change; filed EX-968
- [x] dropped · simplify (altitude) · `src/components/tables/*.tsx` · per-kind trash label/toast wording could live in `TRASH_KINDS` — churn across four tables for no behaviour gain
- [x] dropped · simplify (efficiency) · `delete-*-forever.ts` · trash state read three times on delete forever — mirrors kasa/pracownik; the helper's own read keeps the cron path safe
- [x] dropped · simplify (efficiency) · `*_DELETE_TAGS` · child tags also covered by the parent tag — harmless, future-proof if the parent split
- [x] dropped · simplify · `vehicle-schema.ts` · `|| undefined` nit — the spec expects `undefined`, harmless

- [x] fixed · primitive-reuse-scan · `src/components/trash/delete-forever-dialog.tsx:37` · dialog re-implemented the name match — now `isNameConfirmed` from `lib/constants/trash`, the one the server checks with
- [x] fixed · primitive-reuse-scan · `src/components/tables/fleet.tsx:27`, `src/app/(frontend)/flota/[id]/page.tsx:42` · `${make} ${model}` by hand — now `makeModel`
- [x] dropped · primitive-reuse-scan · `src/collections/vehicles.ts:96`, `equipment.ts:125` (+3 older) · identical 5-line closed `trashedAt` field — a zero-param factory saves five lines per collection and hides the closed access behind a name
- [x] dropped · primitive-reuse-scan · `lib/{fleet,equipment}/describe-trash.ts`, `tables/cash-registers.tsx`, `trash-investment-button.tsx` · shared opening sentence — the pronoun differs per kind; a helper takes as many params as it replaces

## Simplify pass

Ran /simplify (4 agents: reuse, simplification, efficiency, altitude) — 8 applied, 2 skipped, 1 dismissed, 4 dropped, 1 filed (EX-968); folded into ## Findings, tagged `simplify`.
Then primitive-reuse-scan — 2 applied, 2 dropped, rest dismissed (per-kind convention, `TrashInvestmentButton`'s async pre-check); tagged `primitive-reuse-scan`.

## Tests & suite

- `tsc --noEmit` — clean on the slice (the one error is in another change's `ai-kosztorys-generation-tests` script).
- Touched unit/DOM specs — `trash.test.ts`, cleanup route, `components/{trash,tables,presets,investments}`, `workers/describe-trash` — green.
- Touched DB specs (5435) — vehicle/equipment/kasa/worker trash, `lib/fleet`, equipment purge, `equipment.db`, both duplicate specs — green.
- Full suite — deferred by user (pre-push runs the unit + integration legs).
- E2E — not authored here; filed to the E2E backlog as EX-969.
