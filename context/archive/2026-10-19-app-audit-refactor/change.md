---
change_id: app-audit-refactor
title: Audit and refactor the app code before the next features
status: archived
created: 2026-10-19
updated: 2026-10-19
archived_at: 2026-10-19T14:59:17Z
branch: app-audit-refactor-wt
worktree: null
---

## Notes

Duży audyt i refaktor kodu aplikacji — to samo, co zrobiliśmy z testami, teraz z resztą apki, zanim
zaczniemy dokładać kolejne ficzery. Nie tylko `/simplify`: apkę sprawdzamy w przeglądarce pod różnymi
kontami (ADMIN / OWNER / MANAGER / EMPLOYEE). Testy są już uporządkowane, więc powinny wyłapać
regresje wprowadzone przez refaktor.

## Directories

One row per directory; tick a column when that pass is done for the whole directory. **Roles** lists
the accounts the surface was checked under in the running app (`—` = no UI surface).

Out of scope: `src/migrations/` (frozen history), `src/payload-types.ts` (generated), `src/__tests__/`
(done in `test-suite-audit` / `unit-suite-speed`).

Per-role click-throughs live in `context/foundation/manual-checks.md` (the app-audit-refactor sections).
Items held back until after the staging merge, plus two owner questions: EX-1118.

| Directory                                                                                                                           | Files | Audited | Refactored | Roles checked |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----: | :-----: | :--------: | ------------- |
| `src/app/(frontend)`                                                                                                                |    68 |   [x]   |    [x]     |               |
| `src/app/(share)`                                                                                                                   |    10 |   [x]   |    [x]     |               |
| `src/app/(auth)`                                                                                                                    |    10 |   [x]   |    [x]     |               |
| `src/app/(legal)`                                                                                                                   |     4 |   [x]   |    [x]     |               |
| `src/app/(payload)`                                                                                                                 |    10 |   [x]   |    [x]     | —             |
| `src/access`                                                                                                                        |     2 |   [x]   |    [x]     | —             |
| `src/collections`                                                                                                                   |    27 |   [x]   |    [x]     | —             |
| `src/globals`                                                                                                                       |     3 |   [x]   |    [x]     | —             |
| `src/hooks`                                                                                                                         |    52 |   [x]   |    [x]     | —             |
| `src/stores`                                                                                                                        |     7 |   [x]   |    [x]     | —             |
| `src/types`                                                                                                                         |    14 |   [x]   |    [x]     | —             |
| `src/scripts`                                                                                                                       |    38 |   [x]   |    [x]     | —             |
| `src/components/ui`                                                                                                                 |   113 |   [x]   |    [x]     |               |
| `src/components/tables`                                                                                                             |    29 |   [x]   |    [x]     |               |
| `src/components/forms`                                                                                                              |    99 |   [x]   |    [x]     |               |
| `src/components/dialogs`                                                                                                            |    27 |   [x]   |    [x]     |               |
| `src/components/filters`                                                                                                            |    13 |   [x]   |    [x]     |               |
| `src/components/nav`                                                                                                                |    16 |   [x]   |    [x]     |               |
| `src/components/kosztorys/editor`                                                                                                   |   187 |   [x]   |    [x]     |               |
| `src/components/kosztorys/summary`                                                                                                  |    47 |   [x]   |    [x]     |               |
| `src/components/kosztorys/worker-report`                                                                                            |    19 |   [x]   |    [x]     |               |
| `src/components/kosztorys` (top-level files)                                                                                        |     3 |   [x]   |    [x]     |               |
| `src/components/investments`                                                                                                        |    22 |   [x]   |    [x]     |               |
| `src/components/transfers`                                                                                                          |    15 |   [x]   |    [x]     |               |
| `src/components/worker-expenses`                                                                                                    |    13 |   [x]   |    [x]     |               |
| `src/components/worker-reports`                                                                                                     |    12 |   [x]   |    [x]     |               |
| `src/components/fleet`                                                                                                              |    11 |   [x]   |    [x]     |               |
| `src/components/work-catalogue`                                                                                                     |     9 |   [x]   |    [x]     |               |
| `src/components/equipment`                                                                                                          |     7 |   [x]   |    [x]     |               |
| `src/components/trash`                                                                                                              |     7 |   [x]   |    [x]     |               |
| `src/components/leads`                                                                                                              |     6 |   [x]   |    [x]     |               |
| `src/components/media`                                                                                                              |     6 |   [x]   |    [x]     |               |
| `src/components/users`                                                                                                              |     6 |   [x]   |    [x]     |               |
| `src/components/dashboard`                                                                                                          |     5 |   [x]   |    [x]     |               |
| `src/components/payouts`                                                                                                            |     5 |   [x]   |    [x]     |               |
| `src/components/pwa`                                                                                                                |     5 |   [x]   |    [x]     |               |
| `src/components/sheets`                                                                                                             |     5 |   [x]   |    [x]     |               |
| `src/components/company-knowledge`                                                                                                  |     4 |   [x]   |    [x]     |               |
| `src/components/presets`                                                                                                            |     3 |   [x]   |    [x]     |               |
| `src/components/{auth,cash-registers,i18n,notification-recipients,telmak-check}`                                                    |     5 |   [x]   |    [x]     |               |
| `src/lib/actions`                                                                                                                   |    68 |   [x]   |    [x]     | —             |
| `src/lib/queries`                                                                                                                   |    73 |   [x]   |    [x]     | —             |
| `src/lib/db`                                                                                                                        |    74 |   [x]   |    [x]     | —             |
| `src/lib/kosztorys` (top-level files)                                                                                               |   119 |   [x]   |    [x]     | —             |
| `src/lib/kosztorys/*` (subdirectories)                                                                                              |   114 |   [x]   |    [x]     | —             |
| `src/lib/utils`                                                                                                                     |    66 |   [x]   |    [x]     | —             |
| `src/lib/media`                                                                                                                     |    24 |   [x]   |    [x]     | —             |
| `src/lib/constants`                                                                                                                 |    22 |   [x]   |    [x]     | —             |
| `src/lib/fleet`                                                                                                                     |    22 |   [x]   |    [x]     | —             |
| `src/lib/leads`                                                                                                                     |    20 |   [x]   |    [x]     | —             |
| `src/lib/investments`                                                                                                               |    16 |   [x]   |    [x]     | —             |
| `src/lib/equipment`                                                                                                                 |    14 |   [x]   |    [x]     | —             |
| `src/lib/ai`                                                                                                                        |    13 |   [x]   |    [x]     | —             |
| `src/lib/google`                                                                                                                    |    12 |   [x]   |    [x]     | —             |
| `src/lib/i18n`                                                                                                                      |    12 |   [x]   |    [x]     | —             |
| `src/lib/workers`                                                                                                                   |     9 |   [x]   |    [x]     | —             |
| `src/lib/{auth,cache,cash-registers,cron,email,env,expense-duplicates,nav,push,pwa,schemas,table,telmak,transfers,worker-expenses}` |    63 |   [x]   |    [x]     | —             |
| `src/` root (`payload.config.ts`, `proxy.ts`, `fonts/`)                                                                             |     3 |   [x]   |    [x]     | —             |
