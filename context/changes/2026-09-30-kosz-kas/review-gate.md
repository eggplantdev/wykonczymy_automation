# Review-gate ledger — kosz-kas (EX-917) · 2026-09-30

Scope: `git diff 6b02742f...HEAD` (merge-base with `staging`), 67 files, no untracked paths.
Step 0.5 (browser verification pass) skipped — no Playwright in this run; manual checks live in
`context/foundation/manual-checks.md` § EX-917.

Fan-out: `/10x-impl-review` (APPROVED), `/code-review`, `tailwind-v4-audit` (0 findings),
`feature-first-structure`, `module-cohesion-audit`, `structure-scatter-audit` (diff-scoped),
`comment-noise-audit` (flag-only).

## Findings

- [x] 🟡 WARNING · fixed · code-review · `src/collections/cash-registers.ts:85` · a MANAGER's REST `PATCH /api/cash-registers/<id> {trashedAt}` trashed a kasa past the use check, the default clearing and the MAIN hiding — `trashedAt` field access now `create/update: () => false`; both writers (trash core, restore) use `overrideAccess: true`. Same hole closed on `investments.trashedAt` (`src/collections/investments.ts:165`, identical mechanism, writers verified `overrideAccess: true`)
      test: test-driven-debugging · integration — `cash-registers-update-guard.test.ts` „ignores trashedAt on an access-checked update": red without the field access (row stamped), green with it; asserts the persisted `trashed_at`
- [x] 🟡 WARNING · skipped · code-review · `src/lib/actions/cash-register-trash.ts:48` · READ COMMITTED race: a transfer committed between the use count and the trash write lands on a trashed kasa — accepted and documented at the call site; the delete-forever re-counts inside `beforeDelete` and refuses, Przywróć gives the kasa back; mirrors the investment trash; 5 users
      test: no automated test · — a two-connection interleaving; the backstop (delete re-count) is covered by `purge-trash.db.test.ts` „blocked"
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/utils/default-cash-register.ts:8` · a form whose ref data predates the trash preselected the (now trashed, server-cleared) default kasa — `getUserDefaultCashRegisterId` answers `undefined` unless the id is among the offered (live) kasy, so the preselect and the „zapisz jako domyślną" button both drop it (placed at that depth per the simplify/altitude finding below)
      test: TDD · unit — `default-cash-register.test.ts` „returns empty string when the default kasa is no longer offered": red first, then green
- [x] 🟡 WARNING · filed · impl-review · browser E2E owed by the slice (/kasy „Do kosza", stale form refused, /kosz „Kasy" restore + delete forever, MANAGER sees no MAIN, owner lock) — crosses action → DB → revalidation; filed EX-952 (`e2e-backlog`)
      test: no automated test yet · e2e — the flows and disposition travel with EX-952
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/collections/cash-registers.ts:38` · MANAGER can't hard-delete but can trash-then-purge — MANAGER parity on the trash is an owner ruling (2026-09-29, kosz-inwestycji-manager)
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/collections/users.ts` · a user delete is blocked by a trashed kasa they own — by design; EX-918 pairs the worker with their kasa
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/app/(frontend)/kasa/[id]/page.tsx` · an EMPLOYEE gets 404 on their own trashed WORKER kasa — intended; the worker/kasa pairing is EX-918's
- [x] 🔵 OBSERVATION · dropped · code-review · `src/lib/cash-registers/delete-cash-register-forever.ts` · a kasa deleted between list and delete reports as `blocked` rather than missing — cron-only log wording, no user surface
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/app/(frontend)/kasa/[id]/page.tsx:66` · the owner-lock flag is a render-time snapshot — the update guard re-checks on save; the flag is a courtesy
- [x] 🟡 WARNING · fixed · impl-review · `context/changes/2026-09-30-kosz-kas/plan.md:503` · plan drift: Phase 4 §4 specified `isUsed` / `selectUsedRegisterIds` on `/kasy`; the build computes `isOwnerLocked` from `cashRegisterDeleteBlocker` on `/kasa/[id]` — addendum added, Performance section corrected
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/lib/cash-registers/trash-cash-register.ts:23` · add `skipRevalidation` to the trash write — already carried: `withPayloadTransaction(…, SKIP_HOOK_REVALIDATION)` sets it on `req.context`, which the update inherits
- [x] 🔵 OBSERVATION · dismissed · impl-review · helper placement for the owner-lock read — one call on one page; a `lib/queries` wrapper adds a hop for nothing
- [x] 🔵 OBSERVATION · dismissed · impl-review · stale form submitting a trashed kasa — covered by the transfers `validate` gate (`validate-register-trash.test.ts`)
- [x] fixed · feature-first-structure · `src/types/trash.ts:15` · `DeleteForeverResultT` lived in `lib/investments/` and the kasa module imported across into it — promoted to `types/trash.ts`
- [x] fixed · feature-first-structure / structure-scatter · `src/lib/constants/cash-register-lock.ts` · kasa refusal sentences sat in `constants/trash.ts` beside the retention while the investment ones live in `investment-lock.ts` — moved to `cash-register-lock.ts` (mirrors `investment-lock.ts`); `trash.ts` keeps `ENTITY_TRASH_RETENTION_DAYS` only
- [x] dropped · module-cohesion · `REGISTER_TYPE_LABELS` placement — pre-existing, untouched by this slice
- [x] dismissed · module-cohesion · `src/lib/queries/trash.ts` split — one reader shaping one `/kosz` view; two kinds is not two concerns
- [x] fixed · module-cohesion · `src/lib/cron/purge-trashed-rows.ts` · the two purge loops were copy-paste (and EX-918 / flota / sprzęt add more) — extracted `purgeTrashedRows`; both callers keep only their SQL and tags
- [x] fixed · comment-noise · `src/components/trash/trash-kinds.ts:17` · `lost` JSDoc restated the optional — deleted
- [x] dismissed · comment-noise · `src/components/trash/trash-kinds.ts:25` · „Declaration order is the order of the /kosz sections" — load-bearing: `TRASH_KIND_ORDER` derives from key order
- [x] dismissed · comment-noise · `src/components/forms/form-fields/entity-combobox-field.tsx:60` · `lockedReason` JSDoc — says what the prop renders (disabled + hint), which the name doesn't
- [x] fixed · comment-noise · `src/lib/db/cash-register-gate.ts:6` · first sentence restated the name — trimmed to „A missing id is not trashed."
- [x] fixed · comment-noise · `src/types/trash.ts` · `mustTypeName` JSDoc restated the name — deleted
- [x] fixed · comment-noise · `src/lib/cash-registers/trash-cash-register.ts:7` · first JSDoc sentence restated the signature — deleted
- [x] dismissed · comment-noise · `src/hooks/cash-registers/guard-update.ts:11` · „read-only apart from its restore" — explains the non-obvious `resolved('trashedAt')` condition
- [x] dismissed · comment-noise · `src/lib/cash-registers/delete-blocker.ts:4` · „spelled once: … all ask it" — tells the next reader not to fork the predicate
- [x] fixed · comment-noise · `src/migrations/20260930_2_cash_register_trashed_at.ts:3` · „Hand-written" + descriptive sentence — trimmed to the shape reason and the additive/migrate-first paragraph
- [x] fixed · comment-noise · `src/__tests__/hooks/transfers/validate-register-trash.test.ts:5` · header trimmed to the consequence; adapter narration deleted
- [x] fixed · comment-noise · `src/__tests__/lib/actions/cash-register-trash.db.test.ts:8` · trimmed to the session-mock sentence; duplicate MAIN comment at the MANAGER test deleted
- [x] fixed · comment-noise · `src/lib/queries/trash.ts:38` · MAIN comment duplicated the action JSDoc — deleted
- [x] dismissed · comment-noise · `src/__tests__/collections/cash-registers-update-guard.test.ts:11` · „reads the row back" — the rationale for the `readRow` pattern
- [x] dismissed · comment-noise · `src/__tests__/lib/queries/transfer-mapping.test.ts:59` · the why of the union name map
- [x] fixed · comment-noise · `src/__tests__/app/(payload)/api/cron/cleanup/route.test.ts:5` · spec-file pointer (rots) — generalised
- [x] dropped · comment-noise · cron `route.ts` trim — pre-existing
- [x] fixed · simplify · `src/lib/cron/purge-trashed-rows.ts:4`, both `purge-trash.ts:11` · result types exported with no importer — un-exported
- [x] dropped · simplify · `src/collections/cash-registers.ts:85` · a named `denyField` access helper for the `() => false` literal — idiomatic Payload, 9 inline copies already; a name adds nothing
- [x] dropped · simplify · `purgeTrashedRows` `logPrefix` wording — cosmetic
- [x] fixed · simplify · `src/lib/utils/default-cash-register.ts:8` · altitude: the live-kasa check sat in `getDefaultCashRegister`, leaving `getUserDefaultCashRegisterId` to seed the save-default button with the stale id — moved one level down; settle-payouts computes its own default server-side at dialog open and is backstopped by the transfers gate
- [x] dropped · simplify · `src/lib/cron/purge-trashed-rows.ts` · altitude: `lib/cron/` vs a `lib/trash/` home — the loop runs only from the cleanup cron; move it if a non-cron caller appears
- [x] dismissed · simplify · `src/lib/utils/default-cash-register.ts:12` · `.some` scans when the default is `undefined` — ~40 in-memory rows

## Simplify pass

Ran /simplify (reuse, simplification, efficiency, altitude) over the review-fix diff — 2 applied, 0 proposed, 4 dropped/dismissed; each finding folded into ## Findings (tagged simplify).

## Tests & suite

- typecheck (`tsc --noEmit`): clean apart from the pre-existing `subcontractor-due-by-plane.test.ts:289` (not this slice)
- eslint on touched files: clean
- touched specs vs 5435 after the final edits: 8 files / 41 tests green (update guard, users default-register guard, default-cash-register, validate-register-trash, cash-register-trash.db, cleanup cron route, both purge-trash.db)
- E2E: filed EX-952
- full suite (`pnpm test` / `test:integration`): deferred by user — the pre-push hook runs both legs
