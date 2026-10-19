---
date: 2026-10-19T09:35:00+0200
researcher: Claude (Opus 5.5)
git_commit: 28186af47d232f37331c537182dc94d318833f32
branch: staging
repository: wykonczymy
topic: 'Baseline for the app-code audit and refactor (everything under src/ except tests)'
tags: [research, codebase, refactor, audit, roles, layering, dead-code, duplication]
status: complete
last_updated: 2026-10-19
last_updated_by: Claude (Opus 5.5)
---

# Research: Baseline for the app-code audit and refactor

**Date**: 2026-10-19T09:35:00+0200
**Git Commit**: 28186af47
**Branch**: staging

## Research Question

Where is the refactor value in `src/` (excluding `__tests__`, `migrations`, `payload-types.ts`), what
is safe to touch given the test net, what must not be undone, and what does each account (ADMIN /
OWNER / MANAGER / EMPLOYEE / anon) need to click through after each directory is refactored?

## Summary

- **The code is mostly healthy.** jscpd: 0.17 % duplication; knip: no dead files under `src/`
  (a dead-code sweep already ran 2026-10-18). ~114 k LOC.
- **The value is concentrated.** The kosztorys editor pair (`use-kosztorys-editor.ts` 1193 LOC / 194
  commits since July, `kosztorys-editor-body.tsx` 761 / 160) is the only real god-module pair, and
  it is also the largest untested-by-import area (7.6 k LOC). Next: `lib/actions` ↔ `lib/db` boundary
  (reads in actions, multi-step flows in db), `components/forms/expense-form`, `src/hooks` mixing
  Payload hooks with React hooks.
- **The rest is small mechanical cleanups** (S-size): one sort-param factory for 8 files, shared
  trashed-aware uniqueness check, `trashedAtField`, duplicated Polish label maps in two collections,
  single-feature files in `src/types`/`lib/utils`, 7 production-dead count functions.
- **Two access findings for the owner** (not refactor — behaviour): a MANAGER can deactivate any cash
  register from the `/kasy` table toggle, and three unauthenticated exports live in a `'use server'`
  file (`sheets-sync.ts`).
- **Guards that don't guard:** the dependency-cruiser env rule targets a non-existent path and no
  script runs depcruise; `ui/` → feature, `lib/db` shape and hook-home rules are review-only.
- **AGENTS.md vs code:** 94 hand-written `useMemo`/`useCallback` despite "React Compiler is on — no
  hand-written useMemo/useCallback"; 52 of them in the editor pair, some with a stated perf reason
  (`use-kosztorys-editor.ts:384`).

## Detailed Findings

### 1. Hotspots (size × churn since 2026-07-01)

| Commits |  LOC | File                                                        | Verdict                                                                                                                                                                                                        |
| ------: | ---: | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|     194 | 1193 | `components/kosztorys/editor/use-kosztorys-editor.ts`       | **god** — undo bursts (271–375), ~25 derived totals (377–650), section CRUD (692–950), catalogue ops (951–1000), grid change pipeline (1023+). `components/kosztorys/AGENTS.md` calls it a "composition entry" |
|     160 |  761 | `components/kosztorys/editor/kosztorys-editor-body.tsx`     | **god** — one ~630-line component (133–761), 23 `useMemo`, history/report/preview modes + row-height measurement (370–465)                                                                                     |
|     124 |  380 | `components/kosztorys/editor/grid/kosztorys-v2-columns.tsx` | cohesive, part of a cycle (§4)                                                                                                                                                                                 |
|     118 |  727 | `lib/actions/kosztorys.ts`                                  | **mixed** — four aggregates: items, sections (290), investment settings (139–223), stages (521–704)                                                                                                            |
|      77 |  517 | `components/forms/expense-form/expense-form.tsx`            | cohesive container; exports `ParagonRowT` (:77) feeding a cycle                                                                                                                                                |
|      49 |  458 | `lib/actions/transfers.ts`                                  | cohesive                                                                                                                                                                                                       |
|      39 |  836 | `lib/db/worker-expense-drafts.ts`                           | **mixed** — multi-step flows (§3)                                                                                                                                                                              |
|       — |  615 | `components/forms/expense-form/line-items-field.tsx`        | mixed: row-select helpers (107–145), component, file-scan ingestion (~213–240)                                                                                                                                 |
|       — |  542 | `lib/google/sheets.ts`                                      | `setupTab` (249–531) is one 280-line imperative function                                                                                                                                                       |
|       — |  451 | `lib/constants/transfers.ts`                                | mild grab-bag: spec table (51–211) + payment methods / VAT planes (291–340)                                                                                                                                    |

Data-only or single-purpose despite size: `lib/kosztorys/catalogue-name-fixes.ts` (1961, one Map),
i18n dictionaries, `review-lines-table.tsx`, `worker-report-review.tsx`, `sheet-compare-dialog.tsx`,
`row-conditions/registry.ts`. `scripts/backfill-heic-media.ts` (409) is a one-off — archive/delete
candidate.

### 2. Duplication and reuse misses (ranked value ÷ risk, all S unless marked)

1. Sort-param parsing ×4 (`lib/queries/{transfer,lead,expense-draft,worker-report}-sort.ts`) + 4
   identical `isServerSortable*Column` (`lib/{transfers,leads,worker-expenses,kosztorys/worker-report}/sortable-columns.ts`)
   → one factory in `lib/table/`.
2. Trashed-aware uniqueness check ×3: `lib/actions/equipment.ts:17-36`, `fleet.ts:24-42`,
   `workers.ts:15-22`.
3. Hand-written action boilerplate outside `protectedAction`: `lib/actions/toggle-active.ts:31-56`,
   `toggle-lead-contact-status.ts:12-34`.
4. `trashedAt` field block ×7 collections (`cash-registers.ts:81`, `equipment.ts:109`, `leads.ts:189`,
   `investments.ts:232`, `templates.ts:26`, `vehicles.ts:93`, `users.ts:123`).
5. Polish label maps twice: transfer types `collections/transfers.ts:23-43` vs
   `lib/constants/transfers.ts:51-200`; payment methods `collections/transfers.ts:52-57` vs
   `constants/transfers.ts:291-305`; register types `collections/cash-registers.ts:58-62` („Główna")
   vs `components/tables/cash-registers.tsx:11` („Główne"). Vehicles/equipment already build options
   from lib maps (`collections/vehicles.ts:86`). Values are persisted — change labels only, never keys.
6. `REGISTER_TYPE_LABELS`/`_BORDER_COLORS` exported from `components/tables/cash-registers.tsx:11-20`,
   imported by a form and the dashboard → move to `lib/`.
7. Production-dead count functions (kept alive only as test oracles for the combined
   `lib/db/shell-badge-counts.ts:23-25`): `lib/db/notifications.ts:34,72,100`,
   `payout-confirmation.ts:117`, `worker-expense-drafts.ts:325`, `worker-reports.ts:478`,
   `work-catalogue.ts:143`. Apply the lessons.md rule „name the bug it would stop catching" before
   moving them into test helpers.
8. 7 constants + 28 types exported but used only in-file (knip list in the scratchpad run) — drop
   `export`, gate on `tsc`.
9. Client filter + pagination table clone (57 lines): `worker-expenses/worker-expense-drafts-table.tsx:84-136`
   ≈ `worker-reports/worker-report-history-table.tsx:73-126` (M).
10. Hand-rolled segmented switches vs `ui/toggle-group.tsx`: `transfers/cards/transfer-view-switch.tsx:22-45`,
    `nav/ui-scale-switch.tsx:43-60` — zero visual change required (memory: wrap without restyling).
11. `ui/balance-cell.tsx:11` checks `value < 0` unrounded; `signedMoneyColor`
    (`signed-money-display.tsx:7-10`) rounds first so „0,00" isn't red. `settle-payouts-table.tsx:147-158,197`
    re-implements it. Possible small correctness bug — verify with a -0.004 value.
12. Kosztorys ↔ szablon twins: insert section `actions/kosztorys.ts:326-360` ≈ `template-structure.ts:148-178`;
    `resolveNewItemSlot` ≈ `resolveNewTemplateItemSlot` (`template-structure.ts:203`);
    `lib/db/kosztorys-layout.ts:43` ≈ `template-structure.ts:195` (M, transactional — lessons.md says
    a shared editor injects the action set, tables stay separate).
13. Auth form clone: `(auth)/zaloguj/login-form.tsx:39-58` ≈ `zapomniane-haslo/forgot-password-form.tsx:38-55`
    (low value).

Already clean (don't touch): money/date formatting (`formatPLN`, `formatPLDate`, `roundToCents`),
`ConfirmDialog` (32 users) / `FormDialogShell` / `DialogActions`, SQL `trashed_at IS NULL` /
`cancelled IS NOT TRUE` fragments (short, readable).

### 3. Layering vs AGENTS.md „Where code lives"

- **`components/ui` imports upward:** `ui/badge.tsx:1` (`RoleT` + `RoleBadge` — domain),
  `ui/pie-legend.tsx:1`, `ui/slice-pie.tsx:8` (`@/lib/kosztorys/format`), `ui/form-dialog.tsx:4`,
  `ui/pending-submit-indicator.tsx:4` (stores). `ui/use-history-back.ts` is a hook in ui.
  `ui/column-order-dialog.tsx` ↔ `ui/column-toggle-menu.tsx` cycle.
- **`lib/db` beyond one statement + mapper:** `worker-expense-drafts.ts:514` `decideExpenseParagons`
  (lock, clash check, insert, settle), `:674` `mergeExpenseDrafts` (3 statements + refusal rules),
  `snapshots.ts:188` `gcRetentionBands`, `worker-reports.ts:298` `readWorkerReport` (3 queries).
  Caution: these may need one transaction handle — moving the orchestration to `lib/actions` must keep
  the tx.
- **Reads in `lib/actions`:** `kosztorys-snapshots.ts:90`, `template-snapshots.ts:104`,
  `template-tree.ts:110` (twin `readKosztorysRevision` already in `lib/queries/kosztorys-revision.ts:11`),
  `investments.ts:53`, `kosztorys-import.ts:106`, `sheets-sync.ts:131`; borderline
  `worker-expense-drafts.ts:180` (persists the AI read).
- **Non-queries in `lib/queries`:** the 4 `*-sort.ts` param parsers (candidate 1 resolves it).
- **`src/hooks`** holds ~20 Payload collection hooks (`hooks/{cash-registers,equipment,investments,media,transfers,users}`,
  `prevent-delete.ts`, `reset-bookkeeping.ts`, `revalidate-collection.ts`) beside 31 React hooks.
  `hooks/transfers/delete-invoice-media.ts` is being edited by another session right now — move last.
- **Misplaced React hooks:** `worker-expenses/use-expense-draft-acceptance.tsx` (311),
  `worker-reports/use-report-preview.tsx`, `kosztorys/worker-report/use-report-draft.ts`,
  `pwa/use-client-snapshot.ts`; editor hooks outside `editor/hooks/`: `editor/actions/use-tree-rewrite-action.ts`,
  `use-dialog-toggle.ts`, `toolbar/menus/use-filter-reset-action.ts`, `use-kosztorys-filter-menu.ts`,
  `dialogs/preset/use-list-on-open.ts`, `use-preset-sections.ts`, `dialogs/catalogue/use-catalogue-save-preview.ts`.
- **Single-feature `src/types`:** `fleet.ts`, `leads.ts`, `company-knowledge.ts`, `notifications.ts`.
- **Single-consumer `lib/utils`:** `scan-receipt-client.ts`, `net-suggestion.ts`, `default-cash-register.ts`,
  `read-worker-report-client.ts`, `category-costs.ts`, `date.ts` (+ overlapping `date-range.ts`, `days.ts`).
  `lib/schemas/transfer-validation.ts` has one importer.
- **Worker-report UI in 4 places:** `components/worker-reports/`, `components/kosztorys/worker-report/`,
  `components/kosztorys/editor/dialogs/worker-reports/`, `components/tables/worker-reports.tsx`.
- **Clean:** raw `process.env` (scripts only, allowed), datasheet-grid seam.

### 4. Import cycles (depcruise, 46 `no-circular` warnings; output in the session scratchpad)

- `payload.config` → `collections/transfers` → `hooks/transfers/sync-sheet` → `actions/sheets-sync`
  → … → `payload.config`. Lazy (dynamic import at `sync-sheet.ts:36`), but a Payload hook depends on a
  `'use server'` file — fixed by moving the sheet helpers out of it (§5).
- Editor: `kosztorys-actions-context.tsx` ↔ `worker-actions` / `sheet-compare-action` /
  `scan-report-action` / `save-preset-action`; `kosztorys-v2-columns` → … → `use-kosztorys-editor` →
  `kosztorys-v2-columns`.
- `form-base` → `forms/hooks/form-hooks` → `form-checkbox` → `form-base`; `expense-form` ↔
  `use-paragon-decisions`; `leads/capture-lead` → `notify` → `reconcile-sweep` → `capture-lead`;
  i18n dictionaries ↔ `translations.ts`.
- Harmless: `lib/kosztorys/types.ts` cluster is `import type` only. `context/map/repo-map.md:158-163`
  records two cycles as handled lazily on purpose — read before „fixing".

### 5. Per-role surface (for the browser passes)

Gate primitives: `MANAGEMENT_ROLES` (`lib/auth/roles.ts:14`), `requireManagementPage` (→ `/zaloguj`,
`require-management-page.ts:14`), `(auth)/layout.tsx:15` (logged-in → `/`), `(dashboard)/page.tsx:15`
(EMPLOYEE `/` → own `/pracownicy/{id}`), `proxy.ts:13-20` (anon → `/zaloguj` except auth, legal,
`/k/ /z/ /zgloszenie-prac/ /p/`). Nav: all 13 `NAV_LINKS` to every management role, `[]` to EMPLOYEE
(`hooks/use-nav-links.ts:19`); no nav link leads a MANAGER to a 404.

MANAGER differences (all server-backed unless noted): no MAIN registers (`queries/cash-registers.ts:38`,
`/kasa/[MAIN]` → 404), no Marża/Wypłaty columns or margin panel (display only), no kosztorys
financials (`kosztorys_v2/page.tsx:97`), no BONUS (`canBookTransferType`), no COMPANY_FUNDING (client
only — accepted ruling), no reopen of a finished investment (`guard-status-unlock.ts:21-26`),
EMPLOYEE-only account management (`canManageAccount`, `assignableRoles`), recipients read-only,
no sheet delete / preset rename, Kosz without MAIN registers and non-EMPLOYEE accounts.

EMPLOYEE: management routes redirect to own page, except `/kasa/[id]` → 404 (`kasa/[id]/page.tsx:29`)
— inconsistent but harmless; `/pracownicy/[other]` → 404. 9 `sessionAction`s, all scoped to
`ctx.user` (credentials, orphaned media, payout accept/reject, push, session refresh, expense draft
send/delete).

Mutation wrappers: 101 `protectedAction`, 43 `investmentAction`, 16 `templateAction`, 2
`ownerOnlyAction`, 13 inline `requireAuth(MANAGEMENT)`, 9 `sessionAction`, 1 `tokenAction`, 18
unwrapped — of which 11 are gated downstream or public on purpose (`auth.ts`), and:

- **`sheets-sync.ts:239,257,323`** (`removeTransferFromSheet`, `syncSingleTransferToSheet`,
  `syncBulkExpensesToSheet`): exported from a `'use server'` file with no auth, `overrideAccess` reads
  and Sheets writes. Only server code imports them, so they may get no action id — unverified. Moving
  them to a plain server module removes the doubt and the hook→action cycle.
- **`refreshDataAction`** (`refresh.ts:6`): no auth, only `revalidatePath('/', 'layout')`.
- **`toggleCashRegisterActive`** (`toggle-active.ts:80-87`): admits any management role,
  `overrideAccess: true`, no `canViewRegister`; the `/kasy` table toggle has no role check
  (`cash-registers-table.tsx:40-44`), while the form hides `active` from MANAGER
  (`cash-register-form.tsx:51`) and `cash-registers.ts:12-28` strips it. Introduced in `325b3e407`
  („allow toggling state") with no recorded intent. Owner question, not an auto-fix.

Browser matrix (one row per surface; „→own" = redirect to own worker page):

| Surface                                     | ADMIN / OWNER                                          | MANAGER                                                        | EMPLOYEE                                                                                                | anon         |
| ------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------ |
| Shell / nav                                 | 13 links, Admin, Kosz, Manual, Wpłata/Transfer/Wydatek | same                                                           | name link, theme, refresh, logout, UI scale                                                             | → `/zaloguj` |
| `/` dashboard (390 px)                      | tiles, add transaction from top bar                    | same                                                           | → own                                                                                                   | → login      |
| Inwestycje list / detail                    | Marża v1/v2, Wypłaty, margin panel                     | no Marża/Wypłaty/margin                                        | → own                                                                                                   | → login      |
| Finished investment status                  | can reopen                                             | reopen refused                                                 | —                                                                                                       | —            |
| Kasy / `kasa/[id]`                          | MAIN visible, form edits type/active                   | no MAIN, MAIN URL 404, form w/o type/active, table toggle (§5) | `/kasa/1` → 404                                                                                         | → login      |
| Transakcje edit / cancel                    | any row                                                | edit: own rows + LABOR_COST; cancel: the same, plus any PAYOUT the worker rejected, from any kasa — no `canManageRegister` scope (owner ruling 2026-10-19) | —                                                                                                       | —            |
| Wpłata                                      | COMPANY_FUNDING offered                                | not offered                                                    | —                                                                                                       | —            |
| Wypłaty / Rozlicz                           | BONUS offered                                          | no BONUS                                                       | → own                                                                                                   | → login      |
| Pracownicy list                             | any role, trash anyone but self                        | EMPLOYEE only                                                  | → own                                                                                                   | → login      |
| `/pracownicy/[id]` (390 px)                 | edit dialog                                            | edits EMPLOYEE or self                                         | own only: credentials, language, push, payout accept/reject, expense drafts, report links; other id 404 | → login      |
| Zgłoszenia prac / wydatków / leady          | decide; edit recipients                                | decide; recipients read-only                                   | → own                                                                                                   | → login      |
| Kosztorysy v1                               | Delete sheet                                           | no Delete                                                      | → own                                                                                                   | → login      |
| kosztorys_v2 (390 px)                       | edit + financials                                      | edit, no financials                                            | → own                                                                                                   | → login      |
| Flota / Sprzęt                              | edit + recipients                                      | edit, recipients read-only                                     | → own                                                                                                   | → login      |
| Katalog prac / Szablony                     | edit, rename preset                                    | rename refused                                                 | → own                                                                                                   | → login      |
| Kosz                                        | all kinds, typed name on „Usuń na zawsze"              | no MAIN registers, EMPLOYEE accounts only                      | → own                                                                                                   | → login      |
| `/podglad-inwestora`, `/podglad-pracownika` | ✔                                                      | ✔                                                              | → own                                                                                                   | → login      |
| `/k/{token}`, `/z/…/{token}` (390 px)       | public; revoked → 404 / refusal                        |                                                                |                                                                                                         | ✔            |
| `/zgloszenie-prac/x`, `/p/x`                | 404                                                    |                                                                |                                                                                                         | 404          |
| Auth pages, legal                           | logged in → `/`                                        |                                                                | → own                                                                                                   | ✔            |

### 6. Test safety net (import-based; 265 of 742 specs are behaviour-named, so path-mirroring undercounts)

| Directory                      | Files | Imported by a spec | LOC no spec imports | E2E                              |
| ------------------------------ | ----: | -----------------: | ------------------: | -------------------------------- |
| `components/kosztorys/editor`  |   187 |                 74 |            **7593** | 12 `kosztorys-*` specs           |
| `components/ui`                |   113 |                  8 |            **5242** | indirect                         |
| `components/forms`             |    99 |                 33 |            **4630** | transfer, expense, invoice specs |
| `components/tables`            |    29 |                  4 |                2353 | sort/print, listing, filters     |
| `components/kosztorys/summary` |    47 |                 13 |                2063 | global-discount, deposit plane   |
| `collections`                  |    27 |                  3 |                1844 | via Payload boot + hook DB specs |
| `lib/queries`                  |    73 |                 38 |                1443 | indirect                         |
| `hooks`                        |    52 |                 16 |                1334 | indirect                         |
| `components/dialogs`           |    27 |                  3 |                1266 | indirect                         |
| `lib/db`                       |    74 |                 52 |                 657 | parity / golden master           |
| `lib/actions`                  |    68 |                 57 |                 391 | all mutation E2E                 |

Well covered: `lib/{auth,cache,transfers,nav,leads,i18n,fleet,push}`, `lib/kosztorys/*` subdirs,
`access`. No E2E: `wyplaty`, `kasy`, `kosztorysy` routes, „Rozlicz wypłaty", `(legal)`. No test-plan
risk names: `components/ui`, `dialogs`, `nav`/`@investmentCrumb`, i18n, PWA/push, email, telmak,
print path, dashboard. Big files nothing imports: `line-items-field.tsx` (E2E only),
`worker-report-review.tsx`, `sheet-compare-dialog.tsx`, `investment-form.tsx`, `tables/investments.tsx`,
`transfer-filters.tsx`, `use-expense-draft-acceptance.tsx` (E2E only).

**Implication:** `lib/*` refactors are well netted; `components/*` refactors rely on `tsc` + E2E +
the browser passes. The editor split is the riskiest item and is netted by 4 renderHook specs
(`use-kosztorys-editor-*.test.tsx`) and 12 E2E specs.

### 7. What the machine already guards

| Guard                                                                                                                                                                        | Where                                                          | Runs                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `NO_RAW_ENV`, `UNSETTLED_ACTION` (names ending `Action`; top-level `src/hooks/use-*` only), `NO_RAW_UNSTABLE_CACHE`, hooks ↛ `lib/cache/revalidate`, `local/no-domain-drift` | `eslint.config.mjs:15-134`, `eslint-rules/no-domain-drift.mjs` | lint-staged, staged files only                                                                              |
| depcruise `no-hook-imports-revalidate`, `no-payload-graph-imports-env-server`, `no-circular`                                                                                 | `.dependency-cruiser.cjs:8-31`                                 | **never** (no script); env rule targets `^src/lib/env\.server\.ts$` but the file is `src/lib/env/server.ts` |
| `tsc` + unit + DB + parity                                                                                                                                                   | `scripts/pre-push-tests.sh:16-22`                              | pre-push                                                                                                    |

Moving files carries old lint violations along unnoticed — no full `eslint .` runs anywhere.

## Code References

- `src/components/kosztorys/editor/use-kosztorys-editor.ts:271-1023+` — god hook, top churn
- `src/components/kosztorys/editor/kosztorys-editor-body.tsx:133-761` — god component
- `src/lib/actions/kosztorys.ts:139-704` — four aggregates in one file
- `src/lib/db/worker-expense-drafts.ts:514,674` — business flows in the db layer
- `src/lib/actions/sheets-sync.ts:239,257,323` — unauthenticated exports in a `'use server'` file
- `src/lib/actions/toggle-active.ts:80-87` — register toggle, no MANAGER scoping
- `src/components/ui/balance-cell.tsx:11` — sign check before rounding
- `.dependency-cruiser.cjs:30` — dead env rule path
- `src/lib/db/shell-badge-counts.ts:23-25` — replaced the 6 count functions
- `src/collections/transfers.ts:23-57` — duplicated Polish label maps

## Architecture Insights

- The layering in AGENTS.md is real but review-enforced only; the drift is small and local (≈ 30
  sites), so the refactor can fix it and then add `no-restricted-imports` guards for `ui/` and the
  depcruise rules to a script, per `lessons.md:556-557`.
- The kosztorys and szablon editors share an editor with injected action sets (`EditorActionsT`) and
  separate tables on purpose (`lessons.md:597-608`); dedup the action internals, not the tables.
- `lib/db` multi-statement functions exist where one transaction handle spans the steps — moving
  orchestration up must keep that handle (`withPayloadTransaction` semantics, `lessons.md:100-110`).

## Historical Context (from prior changes)

- **EX-515** split three grab-bags; `use-kosztorys-editor` was deferred „behind a renderHook harness".
  That premise is stale — the harness and specs exist (`lessons.md:565-566`). Split into composed
  sub-hooks; never fire a server action inside a `setRows` updater (`lessons.md:392`).
- **Dead-code sweep 2026-10-18** (`871c5c7b7`, `080a73d4f`, `5e2f14b1f`): delete only after `tsc`;
  `components/tables/column-meta.ts` is a module augmentation; `fitRowHeight()` is reachable on purpose.
- **Comment-noise sweeps** (`e417000f1`, `9d2fdb71d`, `6b4120318`); `5c28cfd26` then deliberately
  added accepted-risk comments (e.g. `lib/actions/transfers.ts:408-409`) — keep them.
- **Domain naming** is finished and guarded by `local/no-domain-drift`; the `client*` → `investor*`
  rename was cancelled; slug `'kosztoryses'`, tags and Polish URLs stay; never rename persisted keys,
  hidden-set column ids or sheet column positions (`lessons.md:428-429,462-463,580-582`).
- **Owner rulings that look like bugs:** COMPANY_FUNDING client-only; LABOR_COST/RABAT temporary,
  0 zł on v2 without a kosztorys; plain materiały out of marża; no `+VAT` term; the MANAGER
  „redundant" props are the access gate (`investment-financials-and-discount.md:100-130,319-325`).
- **Method to mirror** — `context/archive/2026-09-15-test-suite-audit/` (working files at `8160e0f75~1`):
  research census → one ledger per phase with a dated baseline and a code taxonomy → one checkbox line
  per finding `[x] · fixed/dismissed/dropped/skipped · CODE · path:line · reason` → `review-gate.md`
  → at archive, durable items into „Kept on purpose" in `change.md`, lessons into `lessons.md`.

## Related Research

- `context/archive/2026-09-15-test-suite-audit/change.md`
- `context/archive/2026-10-18-*-suite-speed/`
- `context/map/repo-map.md` (cycles, depcruise status)
- `context/domain/01-domain-distillation.md`, `context/domain/02-glossary.md`

## Open Questions

1. **`toggleCashRegisterActive`** — may a MANAGER deactivate any register (incl. MAIN, which he can't
   even see) from the `/kasy` table? Owner decision; the form says no, the toggle says yes.
2. **Hand-written `useMemo`/`useCallback` (94)** — strip per AGENTS.md, or keep the ones with a
   stated perf reason (e.g. `use-kosztorys-editor.ts:384`, ~1000-row kosztorys)? Needs a compiler
   output check (`_c(`) per file, not a blanket removal.
3. **`/kasa/[id]` for EMPLOYEE** returns 404 while every other management route redirects to his own
   page — align or leave?
4. **`src/hooks` split** waits for the in-flight `hooks/transfers/delete-invoice-media.ts` work
   (another session) to land.
5. **Order of work** — proposed: (a) guards first (fix the depcruise path, wire depcruise + a
   `ui/` `no-restricted-imports` rule so moved code can't regress), (b) `lib/*` mechanical cleanups
   (well netted), (c) `lib/actions` ↔ `lib/db` ↔ `lib/queries` boundary, (d) `components/*` small
   cleanups, (e) the kosztorys editor split last, each phase closed by a browser pass under the roles
   it touches.
