# Worker page language (EX-996) — Plan Brief

> Full plan: `context/changes/2026-10-05-worker-page-language/plan.md`
> Research: `context/changes/2026-10-05-worker-page-language/research.md`

## What & Why

About 90% of the crew is Ukrainian. Their only screen in the app, their own `/pracownicy/[id]`, is
Polish-only, and only management can set their language. The account's owner gets one switch,
„Domyślny język”. The logged-in app and the worker's report link follow it.

## Starting Point

`users.language` exists and drives the report link. The logged-in app has no i18n provider, so
everything renders Polish. About 265 hard-coded strings reach the worker page, and about 170 of
them are in components shared with management screens.

## Desired End State

A worker picks Українська or Русский in the „Domyślny język” row. Their page, the transfers table,
filters, uploads and menu switch language, and the report link on that phone opens in it too. A
Polish viewer sees exactly today's app.

## Key Decisions Made

| Decision              | Choice                                                            | Why                                               | Source            |
| --------------------- | ----------------------------------------------------------------- | ------------------------------------------------- | ----------------- |
| Number of switches    | One: „Domyślny język”, saved on the account                       | Simpler; the report follows the account           | Owner             |
| Report on this device | The switch also overwrites the report's remembered choice         | A stale device choice would otherwise win         | Owner             |
| „Podgląd pracownika”  | Stays Polish                                                      | The manager doesn't see what the worker picked    | Owner             |
| Scope                 | The whole page, shared components and the menu included           | —                                                 | Owner             |
| Amounts and dates     | `pl-PL`                                                           | Already decided for the report                    | Owner             |
| Who gets the switch   | Every role, on their own page                                     | —                                                 | Owner             |
| Menu                  | Follows the account language for every role                       | One rule                                          | Plan (owner pick) |
| Switch placement      | Dropdown in the „Domyślny język” row                              | Where the setting already shows                   | Plan              |
| „Inwestycja” link     | Plain text for non-management                                     | It led a worker into a management-only page       | Plan              |
| Language source       | Account read in the layout (cached), not a cookie or localStorage | Server sections need it; the account is the truth | Research + owner  |
| Flash on load         | Not a criterion                                                   | —                                                 | Owner             |

## Scope

**In scope:**

- the self-service language action;
- the app-wide provider and `<html lang>`;
- the switch;
- the report-key overwrite;
- translating the worker page, the shared transfers/filters/pagination/print/upload components and the shell;
- the „Inwestycja” link fix.

**Out of scope:**

- a per-device current-language switch;
- translating „Podgląd pracownika”, management-only screens, login, `/admin` and DB data (names, categories, notes);
- non-Polish number and date formats.

## Architecture / Approach

The layout reads the viewer's language once (cached, tagged `users`). It renders `<html lang>` and
mounts a provider. Client components use `useTranslation`, which falls back to Polish, so
management stays as it is. The worker page's server sections get a `locale` prop. Saving goes
through `changeOwnLanguageAction`. Its `users` revalidation re-renders the route, and on success the
switch writes `worker-report-lang:<id>`.

**Accepted consequence:** a manager who sets Ukrainian sees the menu and the converted shared
components (the transfers table and filters) in Ukrainian on management screens too.

## Phases at a Glance

| Phase                         | What it delivers                                           | Key risk                                                      |
| ----------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| 1. Account language plumbing  | Action, cached read, provider, `<html lang>`               | The layout's read must stay cached                            |
| 2. Switch + report key + link | The working switch; the report follows; „Inwestycja” fixed | Shell re-render after the action (fallback: `router.refresh`) |
| 3. Page-only components       | About 95 strings, translated action errors                 | Zod schema factories                                          |
| 4. Shared transfers stack     | About 105 strings, Polish unchanged for management         | Breaking a Polish-asserting spec                              |
| 5. Media/upload + shell       | About 59 strings                                           | not-found outside the page provider                           |

**Prerequisites:** extend `test-plan.md` with two i18n risks (`/10x-test-plan`).
**Estimated effort:** about 3–4 sessions. Phases 3–5 are mechanical but wide.

## Open Risks & Assumptions

- The uk/ru wording is written by the agent. A native speaker on the crew should skim it.
- A manager choosing Ukrainian gets a partly translated management app. This was accepted as a consequence of "menu for everyone".

## Success Criteria (Summary)

- A worker switches the language on their phone, and their whole page and menu follow without a reload.
- The report link on that phone opens in the same language.
- Polish viewers see no difference anywhere.
