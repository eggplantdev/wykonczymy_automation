---
change_id: app-audit-refactor
title: Audit and refactor the app code before the next features
status: implementing
created: 2026-10-19
updated: 2026-10-19
archived_at: null
branch: app-audit-refactor
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

| Directory                                                                                                                           | Files | Audited | Refactored | Roles checked |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----: | :-----: | :--------: | ------------- |
| `src/app/(frontend)`                                                                                                                |    68 |   [ ]   |    [ ]     |               |
| `src/app/(share)`                                                                                                                   |    10 |   [ ]   |    [ ]     |               |
| `src/app/(auth)`                                                                                                                    |    10 |   [ ]   |    [ ]     |               |
| `src/app/(legal)`                                                                                                                   |     4 |   [ ]   |    [ ]     |               |
| `src/app/(payload)`                                                                                                                 |    10 |   [ ]   |    [ ]     | —             |
| `src/access`                                                                                                                        |     2 |   [ ]   |    [ ]     | —             |
| `src/collections`                                                                                                                   |    27 |   [ ]   |    [ ]     | —             |
| `src/globals`                                                                                                                       |     3 |   [ ]   |    [ ]     | —             |
| `src/hooks`                                                                                                                         |    52 |   [ ]   |    [ ]     | —             |
| `src/stores`                                                                                                                        |     7 |   [ ]   |    [ ]     | —             |
| `src/types`                                                                                                                         |    14 |   [ ]   |    [ ]     | —             |
| `src/scripts`                                                                                                                       |    38 |   [ ]   |    [ ]     | —             |
| `src/components/ui`                                                                                                                 |   113 |   [ ]   |    [ ]     |               |
| `src/components/tables`                                                                                                             |    29 |   [ ]   |    [ ]     |               |
| `src/components/forms`                                                                                                              |    99 |   [ ]   |    [ ]     |               |
| `src/components/dialogs`                                                                                                            |    27 |   [ ]   |    [ ]     |               |
| `src/components/filters`                                                                                                            |    13 |   [ ]   |    [ ]     |               |
| `src/components/nav`                                                                                                                |    16 |   [ ]   |    [ ]     |               |
| `src/components/kosztorys/editor`                                                                                                   |   187 |   [ ]   |    [ ]     |               |
| `src/components/kosztorys/summary`                                                                                                  |    47 |   [ ]   |    [ ]     |               |
| `src/components/kosztorys/worker-report`                                                                                            |    19 |   [ ]   |    [ ]     |               |
| `src/components/kosztorys` (top-level files)                                                                                        |     3 |   [ ]   |    [ ]     |               |
| `src/components/investments`                                                                                                        |    22 |   [ ]   |    [ ]     |               |
| `src/components/transfers`                                                                                                          |    15 |   [ ]   |    [ ]     |               |
| `src/components/worker-expenses`                                                                                                    |    13 |   [ ]   |    [ ]     |               |
| `src/components/worker-reports`                                                                                                     |    12 |   [ ]   |    [ ]     |               |
| `src/components/fleet`                                                                                                              |    11 |   [ ]   |    [ ]     |               |
| `src/components/work-catalogue`                                                                                                     |     9 |   [ ]   |    [ ]     |               |
| `src/components/equipment`                                                                                                          |     7 |   [ ]   |    [ ]     |               |
| `src/components/trash`                                                                                                              |     7 |   [ ]   |    [ ]     |               |
| `src/components/leads`                                                                                                              |     6 |   [ ]   |    [ ]     |               |
| `src/components/media`                                                                                                              |     6 |   [ ]   |    [ ]     |               |
| `src/components/users`                                                                                                              |     6 |   [ ]   |    [ ]     |               |
| `src/components/dashboard`                                                                                                          |     5 |   [ ]   |    [ ]     |               |
| `src/components/payouts`                                                                                                            |     5 |   [ ]   |    [ ]     |               |
| `src/components/pwa`                                                                                                                |     5 |   [ ]   |    [ ]     |               |
| `src/components/sheets`                                                                                                             |     5 |   [ ]   |    [ ]     |               |
| `src/components/company-knowledge`                                                                                                  |     4 |   [ ]   |    [ ]     |               |
| `src/components/presets`                                                                                                            |     3 |   [ ]   |    [ ]     |               |
| `src/components/{auth,cash-registers,i18n,notification-recipients,telmak-check}`                                                    |     5 |   [ ]   |    [ ]     |               |
| `src/lib/actions`                                                                                                                   |    68 |   [ ]   |    [ ]     | —             |
| `src/lib/queries`                                                                                                                   |    73 |   [ ]   |    [ ]     | —             |
| `src/lib/db`                                                                                                                        |    74 |   [ ]   |    [ ]     | —             |
| `src/lib/kosztorys` (top-level files)                                                                                               |   119 |   [ ]   |    [ ]     | —             |
| `src/lib/kosztorys/*` (subdirectories)                                                                                              |   114 |   [ ]   |    [ ]     | —             |
| `src/lib/utils`                                                                                                                     |    66 |   [ ]   |    [ ]     | —             |
| `src/lib/media`                                                                                                                     |    24 |   [ ]   |    [ ]     | —             |
| `src/lib/constants`                                                                                                                 |    22 |   [ ]   |    [ ]     | —             |
| `src/lib/fleet`                                                                                                                     |    22 |   [ ]   |    [ ]     | —             |
| `src/lib/leads`                                                                                                                     |    20 |   [ ]   |    [ ]     | —             |
| `src/lib/investments`                                                                                                               |    16 |   [ ]   |    [ ]     | —             |
| `src/lib/equipment`                                                                                                                 |    14 |   [ ]   |    [ ]     | —             |
| `src/lib/ai`                                                                                                                        |    13 |   [ ]   |    [ ]     | —             |
| `src/lib/google`                                                                                                                    |    12 |   [ ]   |    [ ]     | —             |
| `src/lib/i18n`                                                                                                                      |    12 |   [ ]   |    [ ]     | —             |
| `src/lib/workers`                                                                                                                   |     9 |   [ ]   |    [ ]     | —             |
| `src/lib/{auth,cache,cash-registers,cron,email,env,expense-duplicates,nav,push,pwa,schemas,table,telmak,transfers,worker-expenses}` |    63 |   [ ]   |    [ ]     | —             |
| `src/` root (`payload.config.ts`, `proxy.ts`, `fonts/`)                                                                             |     3 |   [ ]   |    [ ]     | —             |
