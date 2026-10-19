# App audit and refactor — Ledger

One line per finding, every box at a terminal disposition:
`- [x] · fixed|dismissed|dropped|skipped · CODE · path:line · reason`. A finding filed to Linear
(project Wykonczymy) carries the id; an open `[ ]` box is one still owed.

| Code     | Meaning                                |
| -------- | -------------------------------------- |
| `DUP`    | duplication                            |
| `LAYER`  | wrong home / layering breach           |
| `CYCLE`  | import cycle                           |
| `DEAD`   | dead code                              |
| `ACCESS` | role gate                              |
| `BUG`    | correctness                            |
| `MEMO`   | hand-written `useMemo` / `useCallback` |
| `GOD`    | oversized module                       |
| `NOISE`  | leftover noise                         |

## Baseline (2026-10-19, `28186af47`)

| Metric                   | Value                                                                                                                                                            | Instrument                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| LOC under `src/` (scope) | ~114 k                                                                                                                                                           | research.md                                                                    |
| Duplication              | 0.17 %                                                                                                                                                           | jscpd (research.md)                                                            |
| Import cycles            | 46 `no-circular` warnings                                                                                                                                        | `pnpm exec depcruise src --config .dependency-cruiser.cjs`                     |
| Hand-written memos       | 94 calls in 25 files                                                                                                                                             | `grep -rE '\buse(Memo\|Callback)\(' src` (`.ts`/`.tsx`, excluding `__tests__`) |
| Full-tree lint           | 1 error (`rules-of-hooks`, a spec), 52 warnings: 42 `no-unused-vars` (39 in frozen migrations), 7 `no-deprecated`, 2 `incompatible-library`, 1 `no-explicit-any` | `pnpm lint` (after the Phase 1 ignores)                                        |

## Phase 1 — Guards and ledger (2026-10-19)

Cycles after the phase: 45 (−1).

- [x] · fixed · `NOISE` · `eslint.config.mjs` · `pnpm lint` linted `.worktrees/` (763 messages) and
      `.playwright-mcp/` (454); both ignored, baseline counts in the table above
- [x] · fixed · `DEAD` · `src/lib/constants/sheets.ts:3` · `SHEET_STATUSES` existed only to derive
      `SheetStatusT`; the union is written out
- [x] · dismissed · `BUG` · `src/__tests__/components/forms/hooks/use-investment-from-url.test.ts:21` ·
      the one lint error (`rules-of-hooks`) is in a spec — `__tests__` is outside this change's scope
- [x] · dismissed · `NOISE` · `no-unused-vars` in `src/migrations/**` (39) and `src/__tests__/**` (2),
      `no-explicit-any` and `incompatible-library` in `src/__tests__/**` · outside scope; migrations are
      frozen history
- [x] · dismissed · `DEAD` · `src/app/(payload)/admin/[[...segments]]/page.tsx:18,26` · deprecated
      `AdminViewProps` in a file Payload regenerates
- [x] · skipped · `DEAD` · `src/components/transfers/print-transfers-button.tsx:70`,
      `src/lib/utils/print-window.ts:28` · deprecated `document.write` — Phase 3, together with the
      duplicated print path
- [x] · skipped · `DEAD` · `src/lib/ai/openrouter.ts:70`, `src/lib/ai/translate.ts:53`,
      `src/lib/ai/worker-report-scan.ts:41` · deprecated `generateObject` — Phase 3
- [x] · skipped · `MEMO` · `src/components/tables/data-table/data-table.tsx:135` · `incompatible-library`
      (TanStack Table under the React Compiler) — Phase 7 with the memo work
- [x] · fixed · `LAYER` · `.dependency-cruiser.cjs` · cut to `no-circular`: the other rules duplicated
      ESLint, `pnpm build` and knip, and `no-payload-graph-imports-env-server` pointed at a path that
      no longer exists (`src/lib/env.server.ts`)
- [x] · fixed · `LAYER` · `eslint.config.mjs` · `no-restricted-imports` for `src/components/ui/**`:
      no `@/components/*` outside `ui/`, no `@/stores/*`, no `@/lib/*` except `utils`, `i18n`,
      `table`, `env`; fires on a deliberate violation of each kind
- [x] · fixed · `LAYER` · `src/components/ui/badge.tsx:1` · `RoleBadge` (knows `RoleT`) moved to
      `src/components/users/role-badge.tsx`; `badge.tsx` keeps the role-agnostic `BADGE_BASE` /
      `BADGE_TONE`
- [x] · fixed · `LAYER` · `src/components/ui/pie-legend.tsx:1`, `src/components/ui/slice-pie.tsx:8` ·
      `formatPercent` from `lib/kosztorys` replaced by a required `formatShare` prop; both kosztorys
      callers pass `formatPercent` (its 99.9 %/100.1 % rule is a kosztorys rule, so it stays there)
- [x] · fixed · `LAYER` · `src/components/ui/form-dialog.tsx:4` · moved to
      `src/components/dialogs/form-dialog.tsx`: it is driven by `useOptimisticFormStore` in five
      places, and 25 consumers would each have had to thread that state in as props
- [x] · fixed · `LAYER` · `src/components/ui/pending-submit-indicator.tsx:4` · moved to
      `src/components/nav/pending-submit-indicator.tsx`: shell chrome over `usePendingStore`, mounted
      once in the `(frontend)` layout
- [x] · fixed · `LAYER` · `src/components/ui/use-history-back.ts` · moved to
      `src/hooks/use-history-back.ts` (consumers in `ui/` and `nav/`)
- [x] · fixed · `CYCLE` · `src/components/ui/column-order-dialog.tsx:13` ↔
      `src/components/ui/column-toggle-menu.tsx:14` · `ColumnToggleItemT` moved to
      `src/lib/table/column-order.ts` beside `ColumnRanksT`

## Phase 2 — Access fixes (2026-10-19)

Cycles after the phase: 42 (−3).

- [x] · fixed · `ACCESS` · `src/lib/actions/toggle-active.ts:86` · `toggleCashRegisterActive` had no
      scope: a MANAGER switched any kasa, the główna included. Now `canManageRegister` (owner ruling): a
      MANAGER switches only his own kasa and an EMPLOYEE's, never the główna or another manager's,
      the OWNER's or an ADMIN's; `toggle-active.db.test.ts` failed first. `/kasy` renders the badge
      read-only on the kasy he may not switch. A first pass blocked MANAGER entirely — misread ruling,
      corrected. Role-rule document: EX-1098
- [x] · fixed · `ACCESS` · `src/lib/actions/cash-register-trash.ts:22` · the trash, restore and „Usuń
      na zawsze" actions checked only the główna, so a MANAGER could bin another manager's or the
      OWNER's kasa; now the same `canManageRegister`, and `/kosz` lists only the kasy he may act on
      (`shapeTrashRows`). `cash-register-trash.db.test.ts` failed first
- [x] · fixed · `ACCESS` · `src/app/(frontend)/kasa/[id]/page.tsx:25` · `requireAuth` +
      `notFound()` replaced by `requireManagementPage`, so an EMPLOYEE lands on his own page; the
      `canViewRegister` 404 for MANAGER on a MAIN register stays
- [x] · fixed · `ACCESS` · `src/lib/actions/sheets-sync.ts` · `removeTransferFromSheet`,
      `syncSingleTransferToSheet`, `syncBulkExpensesToSheet` moved with the tab specs to
      `src/lib/google/transfer-sheet-sync.ts`, so they are no longer unauthenticated action endpoints;
      `sheets-sync.ts` exports only the wrapped actions
- [x] · fixed · `BUG` · `src/components/ui/balance-cell.tsx:11` · sign colour tested the raw amount, so
      a −0.004 residue printed „0,00 zł" in red; now tests `roundToCents(value)`. DOM spec failed
      first. Not `signedMoneyColor`: it paints positives green, which `BalanceCell` never did
- [x] · fixed · `BUG` · `src/components/forms/settle-payouts-form/settle-payouts-table.tsx:197` ·
      the „Pozostało" column had the same raw-sign test; rounded the same way
