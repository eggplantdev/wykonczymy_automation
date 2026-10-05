# Review-gate ledger — worker-kasy-visibility (EX-960) · 2026-10-05

Scope: uncommitted on `staging`, base `HEAD`. Step 0.5 (browser verification pass) skipped — the
manual checks live in `context/foundation/manual-checks.md` § EX-960 for a human.

## Findings

Scope change mid-gate (owner): section renamed „Przypisane kasy”, saldo per kasa + „Razem” row added,
„Wypłaty” total removed from the worker page. Reviewed below together with the original slice.

- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/tables/users.tsx:142` · for a MANAGER the OWNER's row still counts MAIN and names it on hover — the column is defined as „what Do kosza takes along”, and a MANAGER can't trash the OWNER (`canTrash` false), so no dialog contradicts it; the name alone is not the saldo `/kasy` withholds
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/app/(frontend)/pracownicy/[id]/page.tsx:57` · „Domyślny język” rewrap outside the plan — prettier (line exceeded printWidth), not drift
- [x] dismissed · structure-scatter-audit · `src/components/users/owned-registers-section.tsx` · detail-page sections split 2:2 between subject domain (`equipment/`, `transfers/`) and owner domain (`investments/`, `users/`) — both precedents valid; no rule to enforce
- [x] dismissed · feature-first / module-cohesion / tailwind-v4 · — · no findings
- [x] dropped · simplify (reuse) · `src/components/users/owned-registers-section.tsx:28` · `balances[String(id)] ?? 0` also in `shapeCashRegisters` and `kasa/[id]` — a helper's params would equal the code; no win
- [x] dropped · simplify (simplification) · `src/components/users/owned-registers-section.tsx:26` · `rows` spread to attach `balance` — needed by both the rows and `total`; inline lookups would compute it twice
- [x] dismissed · simplify (simplification + altitude) · `src/app/(frontend)/pracownicy/[id]/page.tsx:57` · revert „Domyślny język” rewrap — prettier re-applies it (line > printWidth)
- [x] dismissed · simplify (efficiency) · `src/app/(frontend)/pracownicy/page.tsx:32` · `ownedRegisters` per worker is O(workers × kasy) — ~30×30 in-memory, not worth a Map; `fetchRegisterBalances` is cached and replaced the uncached `fetchFilteredByType`

## Simplify pass

Ran /simplify (4 agents: reuse, simplification, efficiency, altitude) — 1 applied, 2 dropped, 2 dismissed; folded into ## Findings. No separate report.

## Tests & suite

- No new tests: the slice is presentation over cached data; `canViewRegister` is a behaviour-preserving extraction.
- `pnpm typecheck` — clean.
- eslint on every touched file — clean (whole-tree `pnpm lint` was 0 errors before the gate).
- `vitest run` queries/cash-registers, queries/trash, components/trash/delete-forever-dialog — 17/17 green.
- Not run: `cash-register-trash.db.test.ts` (needs db-test 5435; covered by pre-push integration leg), full `pnpm test`, E2E — not asked.
- E2E: not owed separately — read-only display over existing data; the browser risk is in the manual checks.
