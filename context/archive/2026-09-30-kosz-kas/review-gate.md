# Review-gate ledger — kosz-kas (EX-917) · 2026-09-30

Scope: `git diff 6b02742f...HEAD` (merge-base with `staging`), 67 files, no untracked paths.
Step 0.5 (browser verification pass) skipped — no Playwright in this run; manual checks live in
`context/foundation/manual-checks.md` § EX-917.

Fan-out: `/10x-impl-review` (APPROVED), `/code-review`, `tailwind-v4-audit` (0 findings),
`feature-first-structure`, `module-cohesion-audit`, `structure-scatter-audit` (diff-scoped),
`comment-noise-audit` (flag-only).

## Findings

- [x] 🟡 WARNING · skipped · code-review · `src/lib/actions/cash-register-trash.ts:48` · READ COMMITTED race: a transfer committed between the use count and the trash write lands on a trashed kasa — accepted and documented at the call site; the delete-forever re-counts inside `beforeDelete` and refuses, Przywróć gives the kasa back; mirrors the investment trash; 5 users
      test: no automated test · — a two-connection interleaving; the backstop (delete re-count) is covered by `purge-trash.db.test.ts` „blocked"
- [x] 🟡 WARNING · filed · impl-review · browser E2E owed by the slice (/kasy „Do kosza", stale form refused, /kosz „Kasy" restore + delete forever, MANAGER sees no MAIN, owner lock) — crosses action → DB → revalidation; filed EX-952 (`e2e-backlog`)
      test: no automated test yet · e2e — the flows and disposition travel with EX-952
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/collections/cash-registers.ts:38` · MANAGER can't hard-delete but can trash-then-purge — MANAGER parity on the trash is an owner ruling (2026-09-29, kosz-inwestycji-manager)
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/collections/users.ts` · a user delete is blocked by a trashed kasa they own — by design; EX-918 pairs the worker with their kasa
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/app/(frontend)/kasa/[id]/page.tsx` · an EMPLOYEE gets 404 on their own trashed WORKER kasa — intended; the worker/kasa pairing is EX-918's
- [x] 🔵 OBSERVATION · dropped · code-review · `src/lib/cash-registers/delete-cash-register-forever.ts` · a kasa deleted between list and delete reports as `blocked` rather than missing — cron-only log wording, no user surface
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/app/(frontend)/kasa/[id]/page.tsx:66` · the owner-lock flag is a render-time snapshot — the update guard re-checks on save; the flag is a courtesy
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/lib/cash-registers/trash-cash-register.ts:23` · add `skipRevalidation` to the trash write — already carried: `withPayloadTransaction(…, SKIP_HOOK_REVALIDATION)` sets it on `req.context`, which the update inherits
- [x] 🔵 OBSERVATION · dismissed · impl-review · helper placement for the owner-lock read — one call on one page; a `lib/queries` wrapper adds a hop for nothing
- [x] 🔵 OBSERVATION · dismissed · impl-review · stale form submitting a trashed kasa — covered by the transfers `validate` gate (`validate-register-trash.test.ts`)
- [x] dropped · module-cohesion · `REGISTER_TYPE_LABELS` placement — pre-existing, untouched by this slice
- [x] dismissed · module-cohesion · `src/lib/queries/trash.ts` split — one reader shaping one `/kosz` view; two kinds is not two concerns
- [x] dismissed · comment-noise · `src/components/trash/trash-kinds.ts:25` · „Declaration order is the order of the /kosz sections" — load-bearing: `TRASH_KIND_ORDER` derives from key order
- [x] dismissed · comment-noise · `src/components/forms/form-fields/entity-combobox-field.tsx:60` · `lockedReason` JSDoc — says what the prop renders (disabled + hint), which the name doesn't
- [x] dismissed · comment-noise · `src/hooks/cash-registers/guard-update.ts:11` · „read-only apart from its restore" — explains the non-obvious `resolved('trashedAt')` condition
- [x] dismissed · comment-noise · `src/lib/cash-registers/delete-blocker.ts:4` · „spelled once: … all ask it" — tells the next reader not to fork the predicate
- [x] dismissed · comment-noise · `src/__tests__/collections/cash-registers-update-guard.test.ts:11` · „reads the row back" — the rationale for the `readRow` pattern
- [x] dismissed · comment-noise · `src/__tests__/lib/queries/transfer-mapping.test.ts:59` · the why of the union name map
- [x] dropped · comment-noise · cron `route.ts` trim — pre-existing
- [x] dropped · simplify · `src/collections/cash-registers.ts:85` · a named `denyField` access helper for the `() => false` literal — idiomatic Payload, 9 inline copies already; a name adds nothing
- [x] dropped · simplify · `purgeTrashedRows` `logPrefix` wording — cosmetic
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
