# Review-gate ledger — worker-account (EX-985) · 2026-10-05

## Findings

- [x] 🟡 WARNING · dismissed · code-review · `src/components/tables/transfers.tsx:78` · „Inwestycja” cell still links for an employee — owner decision 3 (change.md) keeps it; verified the bounce: `requireManagementPage` → `/zaloguj` → `(auth)/layout.tsx:11` redirects a logged-in user to `/` → his own page, so the „lands on Zaloguj form” scenario does not occur
- [x] 🔵 OBSERVATION · dropped · code-review · `src/lib/queries/fetch-transfers-for-invoices.ts` `fetchWorkerTransfers` · no runtime check on `workerId`/`params` — reachable by management only (an employee is refused by `canViewWorkerPage`'s strict `===`); a bad id is a 500 for a manager typing a URL, not a leak
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/users/owned-registers-section.tsx:37` + `worker-investments-section.tsx` · „Moje …” headings shown to a manager on another worker's page — the owner chose those headings (92df7e08); the empty state is now neutral („Brak aktywnych inwestycji.”)
- [x] 🔵 OBSERVATION · fixed · code-review · `context/changes/2026-10-05-worker-account/plan.md:44` · plan said active/planowana/wycena, code filters `active` only — plan now records the owner's narrowing
- [x] fixed · impl-review F2 · page gates (`canViewWorkerPage`, worker transfer scope) · unit test for `canViewWorkerPage` added (`roles.test.ts`); the browser-level gate path filed as E2E backlog
      test: TDD · unit + e2e — unit spec authored; E2E filed EX-991 (`e2e-backlog`)
- [x] fixed · module-cohesion + feature-first · `src/lib/queries/fetch-transfers-for-invoices.ts` + `pracownicy/[id]/page.tsx` · worker transfer Where composed twice (screen vs Faktury/Drukuj) — one `workerPageTransferWhere` in `lib/queries/worker-transfers.ts`, spec retargeted at it
- [x] fixed · module-cohesion + feature-first · `src/lib/db/stage-split.ts` · `insertStageMembers` minted `worker_report_shares` inline — statement moved to `insertMissingWorkerReportShares` in `lib/db/worker-report-share.ts`, called with the same `db`
- [x] fixed · structure-scatter · `src/components/users/worker-kosztorysy-section.tsx` · name said kosztorysy, renders „Moje inwestycje” — renamed to `worker-investments-section.tsx` / `WorkerInvestmentsSection`
- [x] dismissed · structure-scatter · `src/components/equipment/held-equipment-section.tsx` · pre-existing (katalog-sprzetu), lives in its own domain directory; the worker page composes it, it isn't worker-owned
- [x] dismissed · feature-first · `src/__tests__/lib/queries/transfer-filters.test.ts` · `worker transfer scope → stats SQL` block — it tests the filters→SQL chain, which `transfer-filters` owns; placement defensible
- [x] fixed · code-review · `owned-registers-section.tsx:47` + `held-equipment-section.tsx:50` · hand-rolled conditional link — now `ui/optional-link.tsx`
- [x] fixed · code-review · `src/components/kosztorys/editor/actions/worker-actions.tsx` `requestShare` · single-caller `show(Promise)` helper inlined
- [x] fixed · impl-review F4 · `share-link-panel.tsx` + `lib/actions/kosztorys-worker-share.ts` · comments still described the revoke path / floated loose — reworded and merged into the action's comment
- [x] fixed · impl-review F5 · `context/foundation/manual-checks.md` EX-966 box · still asked to test „Wyłącz link” — reworded (removed in EX-985)
- [x] fixed · comment-noise · `src/lib/auth/roles.ts:32` · deleted — restated `role === 'EMPLOYEE' && id === workerId`
- [x] fixed · comment-noise · `src/lib/queries/worker-transfers.ts:3` · deleted
- [x] fixed · comment-noise · `src/__tests__/lib/actions/worker-share-token.test.ts:141` · vanished-state wording trimmed
- [x] fixed · comment-noise · `src/components/transfers/transfer-table-config.ts:36` · trimmed
- [x] fixed · comment-noise · `src/components/transfers/transfer-table-config.ts:43` · caller list deleted
- [x] fixed · comment-noise · `src/lib/constants/sections.ts:39` · opener trimmed
- [x] fixed · comment-noise · `kosztorys-workers-menu.test.tsx:123` · third copy of the rotate-only reason deleted
- [x] fixed · comment-noise · `src/__tests__/lib/db/stage-memberships.test.ts:15` · deleted
- [x] fixed · comment-noise · `src/__tests__/lib/queries/worker-transfers.test.ts:56` · deleted
- [x] fixed · comment-noise · `src/lib/db/where-to-sql.ts:87` · deleted
- [x] dismissed · tailwind-v4-audit · — · no findings

## Simplify pass

Ran as the main-thread mutating pass over the triaged fixes (dedup of the scope recipe, mint move, `OptionalLink` reuse, `show` inline) — 0 further proposals; nothing held back.

## Tests & suite

- `roles`, `worker-transfers`, `use-nav-links` specs — 29 passed.
- DB specs vs 5435 (`worker-share-token`, `worker-report-page`, `stage-memberships`) — 15 passed.
- `tsc --noEmit` — clean.
- Full suite — skipped by user (pre-push runs it).
