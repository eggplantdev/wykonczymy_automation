# Review-gate ledger — worker-account (EX-985) · 2026-10-05

## Findings

- [x] 🟡 WARNING · dismissed · code-review · `src/components/tables/transfers.tsx:78` · „Inwestycja” cell still links for an employee — owner decision 3 (change.md) keeps it; verified the bounce: `requireManagementPage` → `/zaloguj` → `(auth)/layout.tsx:11` redirects a logged-in user to `/` → his own page, so the „lands on Zaloguj form” scenario does not occur
- [x] 🔵 OBSERVATION · dropped · code-review · `src/lib/queries/fetch-transfers-for-invoices.ts` `fetchWorkerTransfers` · no runtime check on `workerId`/`params` — reachable by management only (an employee is refused by `canViewWorkerPage`'s strict `===`); a bad id is a 500 for a manager typing a URL, not a leak
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/users/owned-registers-section.tsx:37` + `worker-investments-section.tsx` · „Moje …” headings shown to a manager on another worker's page — the owner chose those headings (92df7e08); the empty state is now neutral („Brak aktywnych inwestycji.”)
- [x] dismissed · structure-scatter · `src/components/equipment/held-equipment-section.tsx` · pre-existing (katalog-sprzetu), lives in its own domain directory; the worker page composes it, it isn't worker-owned
- [x] dismissed · feature-first · `src/__tests__/lib/queries/transfer-filters.test.ts` · `worker transfer scope → stats SQL` block — it tests the filters→SQL chain, which `transfer-filters` owns; placement defensible
- [x] dismissed · tailwind-v4-audit · — · no findings

## Simplify pass

Ran as the main-thread mutating pass over the triaged fixes (dedup of the scope recipe, mint move, `OptionalLink` reuse, `show` inline) — 0 further proposals; nothing held back.

## Tests & suite

- `roles`, `worker-transfers`, `use-nav-links` specs — 29 passed.
- DB specs vs 5435 (`worker-share-token`, `worker-report-page`, `stage-memberships`) — 15 passed.
- `tsc --noEmit` — clean.
- Full suite — skipped by user (pre-push runs it).
