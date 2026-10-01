# Review-gate ledger — kosz-pracownikow (EX-918) · 2026-10-01

Scope: `9aaf7e1b..4ca07f7b` (p1–p5 + docs epilogue), 87 files. No untracked files.
Step 0.5 (browser verification) skipped — the slice is not on staging yet; its manual checks live in
`context/foundation/manual-checks.md` § EX-918 for a human.

Fan-out: impl-review, code-review, tailwind-v4-audit, feature-first-structure, module-cohesion-audit,
structure-scatter-audit, comment-noise-audit. Tailwind audit: clean.

## Findings

- [ ] 🟡 WARNING · proposed · code-review + impl-review · `src/lib/actions/toggle-active.ts:57` · deactivation (`toggleUserActive`) now locks the account out and drops its sessions, but has none of the trash guards — a MANAGER can deactivate the OWNER, the last OWNER/ADMIN can deactivate themselves — changes what a MANAGER may do, so it waits for the owner's call
      test: TDD · integration — db spec: MANAGER deactivating OWNER refused, last OWNER deactivating self refused
- [x] 🟡 WARNING · fixed · impl-review · `src/__tests__/reference-data-sql-drift.test.ts` · drift spec failed (Progress 2.3 was checked on a red spec) — `mappingConst` repointed at `workerRows` / `investmentRows`, 5/5 green
      test: no automated test — the spec itself is the guard, now green
- [x] 🔵 OBSERVATION · dropped · code-review · `src/lib/db/worker-trash.ts` · „razem z" list in /kosz names every kasa the worker owns in the trash, incl. one trashed earlier on its own — matches what Usuń na zawsze removes; restore brings back only the paired ones and the rest stay in /kosz → Kasy
      test: no automated test — no defect
- [x] 🔵 OBSERVATION · dropped · code-review · `src/collections/users.ts` · a new account cannot reuse a trashed worker's email until that worker is deleted for good — minor, the message is Payload's own unique-email error
      test: no automated test — no change
- [x] 🔵 OBSERVATION · dropped · code-review · `src/lib/workers/account-removal.ts` · two concurrent removals of the last two OWNERs could both pass the count — 5 users, no realistic concurrency
      test: no automated test — no change
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/db/account-removal.ts` · a deactivated last OWNER does not count as live, so trashing the other refuses — the safe side
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/hooks/users/refuse-disabled-login.ts` · a request already in flight when the account is trashed completes — millisecond window, JWT is the stated revocation boundary
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/components/users/trash-worker-button.tsx` · label „Usuń pracownika" vs plan wording — matches the kasa sibling „Usuń kasę"
- [x] 🔵 OBSERVATION · dismissed · impl-review · plan drift (helper names / file split) — benign, behaviour as planned
- [x] fixed · feature-first-structure · `src/components/workers/trash-worker-button.tsx` · lone file in a new `workers/` dir; its only consumer is `tables/users.tsx` → moved to `src/components/users/`
- [x] fixed · comment-noise-audit · `src/lib/constants/worker-lock.ts:7` · JSDoc on `OWNER_TRASHED_RESTORE_MESSAGE` restated the message — deleted
- [x] dismissed · comment-noise-audit · `worker-gate.ts`, `types/reference-data.ts`, `types/table-rows.ts`, `types/trash.ts`, `actions/worker-trash.ts`, `workers/delete-blocker.ts`, `trash-kinds.ts`, `worker-lock.ts` · flagged comments each carry a consequence or a pin (why the name is pinned, why missing ≠ forbidden, why picker-excluded) — kept
- [x] dropped · module-cohesion-audit · `src/lib/db/worker-trash.ts` · unused-outside-file export `WORKER_NOT_TRASHED_MESSAGE` — same shape as the kasa / investment twins
- [x] dropped · structure-scatter-audit · trash-gate modules split across `lib/db/*-gate.ts` and `lib/workers/` — follows the kasa layout one-to-one
- [x] fixed · simplify · `src/hooks/transfers/validate.ts:105` · worker trash check re-implemented the „newly named id" rule ten lines above → one local `newlyNamed`, one refusal chain
- [x] fixed · simplify · `src/lib/db/worker-report-share.ts:25` · `isWorkerActive` + `isWorkerTrashed` read only as an OR → one `isWorkerLive` computed in SQL
- [x] dropped · simplify · `src/lib/workers/delete-worker-forever.ts:52` · third copy of the delete-forever catch block (kasa, investment) — 5 lines × 3 files, not worth the churn
- [x] dropped · simplify · `src/lib/actions/worker-trash.ts:101` · `accountRemovalRefusal` on a trashed target can only refuse self → a `workerId === user.id` check saves one query — kept for one policy call across trash and delete
- [x] dropped · simplify · `src/lib/workers/delete-worker-forever.ts` · worker row read twice (action + helper) — one PK read on a rare action
- [x] dismissed · simplify · `src/lib/workers/trash-worker.ts:26` · kasa use-check runs before writes and again inside `trashCashRegister` — the pre-check is load-bearing: `withPayloadTransaction` commits a returned refusal, so every refusal is decided before the first write
- [x] dropped · simplify · `kasa/[id]/page.tsx:63`, `queries/cash-registers.ts:35`, `queries/transfer-mapping.ts:36` · `[...workers, ...trashedWorkers]` ×3 → an `allWorkers` list — mirrors `trashedCashRegisters`; changing one twin alone breaks the parity, both is out of proportion
- [x] skipped · simplify · `src/hooks/cash-registers/guard-update.ts:33` · three owner-trashed branches (create, owner change, restore) → one „live kasa needs a live owner" rule — adds a users lookup to every kasa update and widens the guard; review-worthy, not a cleanup
- [x] dropped · simplify · `src/lib/db/worker-gate.ts:7` · near-copy of `trashedRegisterMessage`; `guard-update.ts:30` wraps it in `Boolean` — parity with the kasa gate, table is an SQL identifier
- [x] dropped · simplify · `src/lib/actions/kosztorys.ts:679,790` · trashed-member check ×2 — helper params == the code
- [x] dropped · simplify · `src/lib/actions/toggle-active.ts:20` · `afterUpdate` in the shared toggle config has one user — marginal; moving it out puts the session delete outside the helper's error handling
- [x] dropped · simplify · `src/lib/queries/trash.ts:44,56` · `pairedRegisters: []` on non-worker rows — cosmetic
- [x] dismissed · simplify · `src/lib/db/worker-trash.ts:46` · `ownedIds(db, query: unknown)` „drops the SQL type" — `DbExecutorT.execute` itself takes `unknown`
- [x] deferred · e2e · browser flow (Do kosza → Przywróć z kasami → Usuń na zawsze z nazwą, login refused, guards, stale form) — deferred to E2E backlog EX-963

## Simplify pass

Ran /simplify (reuse, simplification, efficiency, altitude) — 2 applied, 1 skipped, 10 dropped/dismissed; each folded into ## Findings (tagged simplify). No separate report.

## Tests & suite

- `tsc --noEmit` — `src` clean (only errors are in another session's `context/changes/2026-10-01-ai-kosztorys-generation-tests/**/fill-kosztorys.ts`).
- Touched specs: `reference-data-sql-drift` 5/5; `validate-hook` + `hooks/transfers/*` 115 passed; DB specs on 5435 (`token-action`, `worker-report`, transfers `*.db`) 30/30.
- Full suite: not run — awaiting the user's go.
