# Review-gate ledger — worker-kasy-visibility (EX-960) · 2026-10-05

Scope: uncommitted on `staging`, base `HEAD`. Step 0.5 (browser verification pass) skipped — the
manual checks live in `context/foundation/manual-checks.md` § EX-960 for a human.

## Findings

Scope change mid-gate (owner): section renamed „Przypisane kasy”, saldo per kasa + „Razem” row added,
„Wypłaty” total removed from the worker page. Reviewed below together with the original slice.

- [x] 🟡 WARNING · fixed · impl-review + code-review · `src/app/(frontend)/pracownicy/[id]/page.tsx:53` · a MAIN kasa linked to `/kasa/[id]`, which is `notFound()` below OWNER — a MANAGER on the OWNER's page got a dead link (and, after the scope change, would see the main kasa's saldo `/kasy` hides from him). The page now drops MAIN for non-ADMIN/OWNER viewers.
      test: no automated test · — a one-line role filter on a server page; covered by a manual check (MANAGER on the OWNER's page) in manual-checks.md § EX-960
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/tables/users.tsx:142` · for a MANAGER the OWNER's row still counts MAIN and names it on hover — the column is defined as „what Do kosza takes along”, and a MANAGER can't trash the OWNER (`canTrash` false), so no dialog contradicts it; the name alone is not the saldo `/kasy` withholds
- [x] 🔵 OBSERVATION · fixed · code-review · `src/components/users/owned-registers-section.tsx:43` · hand-rolled muted „ · nieaktywna” span → `SummaryLabelCell` `note` (the grid's only sanctioned way to attach one)
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/app/(frontend)/pracownicy/[id]/page.tsx:57` · „Domyślny język” rewrap outside the plan — prettier (line exceeded printWidth), not drift
- [x] dismissed · structure-scatter-audit · `src/components/users/owned-registers-section.tsx` · detail-page sections split 2:2 between subject domain (`equipment/`, `transfers/`) and owner domain (`investments/`, `users/`) — both precedents valid; no rule to enforce
- [x] fixed · comment-noise-audit · `src/lib/workers/owned-registers.ts:3` · „Pass the live kasy” restated what `splitTrashed` guarantees — trimmed to the trash-set rationale
- [x] dismissed · feature-first / module-cohesion / tailwind-v4 · — · no findings
- [x] fixed · simplify (altitude + reuse + simplification) · `src/lib/auth/roles.ts:29` · „MAIN only for ADMIN/OWNER” spelled out 5× (this slice added the 5th) → one `canViewRegister(role, type)`, adopted in `pracownicy/[id]/page.tsx`, `kasa/[id]/page.tsx`, `queries/cash-registers.ts`, `queries/trash.ts`, `actions/cash-register-trash.ts`; behaviour-preserving
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
