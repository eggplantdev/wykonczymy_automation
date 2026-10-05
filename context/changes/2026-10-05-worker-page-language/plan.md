# Worker page language (EX-996) Implementation Plan

## Overview

The account's „Domyślny język” becomes a switch the account's owner sets on their own
`/pracownicy/[id]`. The logged-in app follows the viewer's account language wherever it is
translated: the worker page, the components it shares with management screens, and the shell (menu,
logout, error pages). The worker report link follows the same language. Decisions:
`change.md` 1–7 plus the planning answers below.

## Current State Analysis

- `users.language` is set only by management (`EditWorkerDialog` → `updateWorkerAction`), with
  `'pl'` stored as `null` (`worker-schema.ts:30-33`). REST update on `users` is closed to EMPLOYEE
  (`canUpdateUser`, `src/access/index.ts:46-52`).
- The logged-in app has no i18n provider. `I18nContext` falls back to Polish
  (`src/hooks/use-translation.ts`).
- `src/app/(frontend)/layout.tsx` hard-codes `<html lang="pl">`. `AuthenticatedShell` has only the
  JWT user (id/email/name/role), and the language is not in the JWT.
- `TranslationsProvider` + `LanguageSwitcher` (`components/kosztorys/worker-report/`) serve only
  the report link and „Podgląd pracownika”. They remember a per-device choice under
  `worker-report-lang:<workerId>` via `usePersistedEnum`, and that choice beats the account's language.
- About 265 hard-coded Polish strings reach the worker page (inventory in `research.md` §4):
  - about 95 in files only this page uses;
  - about 170 in shared code (transfers stack about 105, media/upload about 41, shell about 18).
- The transfers table links „Inwestycja” to the management-only `/inwestycje/[id]` for every viewer
  (`src/components/tables/transfers.tsx:85-95`). Only the register columns are stripped for
  non-management (lines 291-295).

## Desired End State

- The owner of a page (any role) sees „Domyślny język” as a flag dropdown. Changing it saves to the
  account, the whole logged-in app re-renders in that language, and the report link on that device
  opens in it too.
- A viewer whose account language is `pl` or unset sees exactly today's app. Every existing
  Polish-asserting spec stays green untouched.
- An EMPLOYEE set to `uk`/`ru` sees their page, the transfers table, filters, upload dialogs,
  pagination, print and the phone drawer in that language. Amounts and dates keep the `pl-PL` format.
- „Podgląd pracownika” stays Polish. „Inwestycja” is plain text for non-management viewers.

### Key Discoveries:

- Self-service action template: `src/lib/actions/account-credentials.ts` (`requireAuth(ROLES)` →
  `runAuthorizedHandler`, id from the session, `['users']` revalidation). DB spec template:
  `src/__tests__/lib/actions/account-credentials.db.test.ts`.
- `fetchReferenceData` is tagged `CACHE_TAGS.users` (`reference-data.ts:184-196`). Every writer of
  `users.language` (the new action, `updateWorkerAction`, the Payload `afterChange` hook) expires that
  tag, so a language read tagged `users` needs no writer count.
- Translator machinery: `translate` / `createTranslator` (cached per locale) / `translatePlural`,
  and the `POLISH_<ns>` default-parameter pattern (`src/lib/i18n/translations.ts:98-99`).
  Dictionaries `src/lib/i18n/dictionaries/{pl,uk,ru}.ts`, with `uk`/`ru` typed `typeof pl`.
- `failureMessage(locale, failure)` (`src/lib/i18n/failure-message.ts`) already maps a failed action
  to a translated sentence via `messageKey`.
- `src/lib/constants/transfers.ts` label maps are read by sheet sync and the Payload graph, so they
  stay Polish. Translation goes around them via an optional translator, never through them.
- `context/foundation/test-plan.md` names no i18n risk yet.

## What We're NOT Doing

- No second, per-device "current language" switch for the logged-in app (superseded by decision 1).
- „Podgląd pracownika” is not changed: it stays Polish.
- Data stays Polish: worker, investment, register, equipment and category names, descriptions, notes.
- Amounts and dates stay `pl-PL` (`formatPLN`, `formatPLDate`).
- Management-only screens and their own strings (dashboards, kosztorys editor, investment pages,
  dialogs an EMPLOYEE never opens) are not translated. They pick up translation only where they render a
  shared component this change converts.
- Login page `(auth)` and the Payload admin are not touched.
- No `saveToJWT` on `language`.

## Implementation Approach

**One rule: the logged-in app speaks the viewer's account language.**

- **Provider.** `AuthenticatedShell` reads the viewer's language with one small cached query and
  mounts a client provider with that `locale` around the whole shell. It also writes `<html lang>`
  on the server, so no effect is needed.
- **Client components** read `useTranslation(ns)`. With no provider, or `pl`, they render today's Polish.
- **Server sections of the worker page** take a `locale` prop resolved by the page from the same
  cached query and call `translate(locale, ns, key)`.
- **Saving the language** goes through a self-service action. Its `users` revalidation re-renders
  the route, layout included, in the new language.
- **The switch** then also writes `worker-report-lang:<ownId>` on the device, so the report link
  there follows it.

**Accepted consequence (planning answer „menu for everyone”).** A manager who sets `uk` on their own
page sees the shell and every converted shared component in Ukrainian on management screens too.
Management-only strings stay Polish.

## Critical Implementation Details

- **The layout's language read must be cheap and cached.** `AuthenticatedShell` runs on every full
  request.
  - Use an `unstable_cache` entry keyed by user id and tagged `CACHE_TAGS.users`, wrapped in React
    `cache()` so the page's read dedups.
  - Do not call `fetchReferenceData` from the layout: it is the whole reference payload.
  - Inside the new action, read with `payload.findByID`, never `fetchReferenceData`: the React
    `cache()` staleness caveat is at `reference-data.ts:49-52`.
- **Verify the re-render after saving.**
  - `updateTag` in a server action refreshes the current route.
  - Confirm in the browser that the shell (the layout) also switches language without a reload.
  - If it doesn't, the switch calls `router.refresh()` after success. Do not add a reload.
- **Write the device key only after the action succeeds.** A failed save must leave the report's
  stored choice untouched.

## Phase 1: Account language plumbing

### Overview

Add the self-service write, the cached read, and the app-wide provider. After this phase, a `uk`
account gets `<html lang="uk">` and a provider. Nothing visible is translated yet.

### Changes Required:

#### 1. Stored-language transform

**File**: `src/lib/i18n/languages.ts`, `src/components/forms/worker-form/worker-schema.ts`, `src/components/forms/worker-form/worker-form.tsx`

**Intent**: Lift the `'pl'`→`null` transform into one named export, so the management form and the
new action store a language the same way. The reverse (`null` → `'pl'`) for display sits beside it.

**Contract**: `storedLanguageSchema` (nullable `languageSchema`, `'pl'` → `null`) and
`displayLanguage(stored: LanguageT | null): LanguageT` exported from `languages.ts`. `workerSchema.language`
uses the schema; `worker-form.tsx:62` uses the helper.

#### 2. Self-service action

**File**: `src/lib/actions/account-language.ts` (new)

**Intent**: The only path for a user to change their own account language, for every role, modelled
on `changeOwnCredentialsAction`. No current password: a language is not a credential.

**Contract**: `changeOwnLanguageAction(language: LanguageT): Promise<ActionResultT>`.
- Validate with `storedLanguageSchema` via `validateAction`.
- Gate: `requireAuth(ROLES)`, account id from the session, no id argument.
- Run through `runAuthorizedHandler(..., ['users'])` with
  `payload.update({ collection: 'users', id, data: { language } })`.
- Failures carry a `messageKey` so a `uk`/`ru` viewer reads them translated.

#### 3. Cached language read

**File**: `src/lib/db/user-language.ts` (new), `src/lib/queries/user-language.ts` (new)

**Intent**: One statement in `lib/db` (`SELECT language FROM users WHERE id = $1`, mapped through
`toLanguage`), and its cached wrapper in `lib/queries`, per the data-access layering rule.

**Contract**: `fetchUserLanguage(userId: number): Promise<LanguageT>`.
- Resolves `null` or a trashed or missing row to `DEFAULT_LANGUAGE`.
- `unstable_cache` keyed by id, tagged `CACHE_TAGS.users`, wrapped in React `cache()`.

#### 4. App provider and `<html lang>`

**File**: `src/components/i18n/app-language-provider.tsx` (new), `src/app/(frontend)/layout.tsx`

**Intent**: Mount the viewer's locale around the shell.
- `<html lang>` comes from the server. `FrontendLayout` renders `<html>` outside `AuthenticatedShell`,
  so the language read moves up, or `<html>` moves into the async part. Keep the `Suspense`/loader
  behaviour unchanged.
- The provider has no `localStorage`: the account is the only source.

**Contract**:
- `AppLanguageProvider({ locale, children })` supplies `I18nContext` with
  `{ locale, setLocale: no-op }`. The account switch goes through the action, not `setLocale`.
- `src/components/i18n/` is the shared i18n UI home. Phase 2 moves the report's provider and
  switcher there too, since they now have a second consumer directory.

### Success Criteria:

#### Automated Verification:

- New DB spec passes: `pnpm exec vitest run src/__tests__/lib/actions/account-language.db.test.ts`. It covers:
  - `uk` is stored;
  - `pl` stores `null`;
  - an invalid value is rejected and leaves the row unchanged;
  - the account written is the session's, asserted on the raw-SQL row.
- `src/__tests__/components/forms/worker-form/worker-schema.test.ts` still passes, with a case for `storedLanguageSchema`.

#### Manual Verification:

- A worker account set to „Українська” by management: view source / devtools shows `<html lang="uk">`
  on its page. A `pl` account still shows `lang="pl"`.

---

## Phase 2: The switch, the report key, the investment link

### Overview

Make „Domyślny język” editable by the page's owner and keep the report link in step. Fix the dead
„Inwestycja” link.

### Changes Required:

#### 1. Move the report i18n pieces to the shared home

**File**: `src/components/kosztorys/worker-report/{translations-provider,language-switcher}.tsx` → `src/components/i18n/`

**Intent**: There is a second consumer directory now, so these move per the consumer-count rule. The
storage key gets one builder that both the provider and the new switch read.

**Contract**: `reportLanguageStorageKey(workerId: number): string` returns
`worker-report-lang:${workerId}`. Imports in `WorkerReportView` and the spec at
`src/__tests__/components/kosztorys/worker-report/translations-provider.test.tsx` follow the move:
mirror the spec path to `__tests__/components/i18n/`.

#### 2. Account language select

**File**: `src/components/users/account-language-select.tsx` (new)

**Intent**: The „Domyślny język” value for the page's owner is a flag dropdown, built like the report's
`SimpleSelect`/`LanguageLabel` options, that saves on change.
- On success, it writes the new language to the report key through `usePersistedEnum`'s setter, so
  the same-tab store notifies.
- On failure, it shows a toast with `failureMessage(locale, failure)` and the value snaps back.

**Contract**: `AccountLanguageSelect({ userId, language })`. It keeps the toolbar variant's phone
behaviour (flag only under `sm`).

#### 3. Page wiring

**File**: `src/app/(frontend)/pracownicy/[id]/page.tsx`

**Intent**: The `infoFields` „Domyślny język” value is `<AccountLanguageSelect>` when `isOwnPage`, and
`<LanguageLabel>` otherwise.

**Contract**: The select is shown when `isOwnPage`, for every role (decision 7).

#### 4. „Inwestycja” plain text for non-management

**File**: `src/components/tables/transfers.tsx`

**Intent**: Strip the `/inwestycje/[id]` link for a non-management viewer, the same way the register
columns already are. Decided in planning.

**Contract**: Extend the non-management `.map` at lines 291-295 to cover column id `investment`, or
fold `investment` into a shared "management-only link columns" set.

### Success Criteria:

#### Automated Verification:

- DOM spec `src/__tests__/components/users/account-language-select.test.tsx` passes. It covers:
  - a successful save writes `worker-report-lang:<id>`;
  - a failed save (mocked action) leaves the key as it was and restores the shown value.
- The moved `translations-provider.test.tsx` passes at its new path.
- `src/__tests__/transfer-table.test.ts` gains a case: for an EMPLOYEE, the „Inwestycja” column has no link.

#### Manual Verification:

- As a worker on a phone (390px), on your own page change „Domyślny język” to Українська. The page and
  menu switch without a reload, and the „Domyślny język” value shows the Ukrainian flag after a refresh.
- After that, open a report link for that worker on the same phone: it opens in Ukrainian, even
  though Polish had been picked there earlier.
- As a manager, open a worker's page: „Domyślny język” is plain text, not a dropdown. On the
  manager's own page it is a dropdown.
- As a worker, tap an investment name in „Transfery”: it is plain text, not a link.

---

## Phase 3: Translate the worker page's own components

### Overview

Translate everything only this page uses. This is about 95 strings: the info rows and section titles,
the four sections, the credentials dialog and form, and expense drafts with their action errors.

### Changes Required:

#### 1. Dictionary namespaces

**File**: `src/lib/i18n/dictionaries/{pl,uk,ru}.ts`

**Intent**: Add namespaces for this page. `pl` holds today's exact strings, so a Polish viewer sees
no change. `uk`/`ru` are typed `typeof pl`, so a missing key fails typecheck.

**Contract**: New namespaces `workerPage` (info rows, section titles, empty states), `account`
(credentials dialog/form, password rules, language switch) and `expenseDrafts` (drafts section,
dialog, pages cell, delete, status badge). Action failures get `notices` keys. Plurals go through
`translatePlural`.

#### 2. Server sections take a locale

**File**: `page.tsx`, `users/owned-registers-section.tsx`, `equipment/held-equipment-section.tsx`, `users/worker-investments-section.tsx`, `worker-expenses/worker-expense-drafts-section.tsx`

**Intent**: The page resolves `locale = await fetchUserLanguage(currentUser.id)` (the viewer's). It
passes the locale to each single-consumer server section, which calls `translate(locale, ns, key)`.
`ROLE_LABELS[role].pl` is replaced by a dictionary lookup on this page only. `ROLE_LABELS` stays,
because the users collection and other screens read it.

**Contract**: Each section gains a `locale: LanguageT` prop. `formatPLDateTime` receives the locale
(it already takes one, for wording).

#### 3. Client components read the context

**File**: `dialogs/account-credentials-dialog.tsx`, `forms/account-credentials-form/*`, `lib/schemas/password.ts`, `worker-expenses/{expense-draft-dialog,expense-draft-pages-cell,delete-expense-draft-button,draft-status-badge}.tsx`

**Intent**: Replace literals with `useTranslation(ns)`. Zod messages are module-level, so the
credentials schema becomes a factory taking a translator. It defaults to the Polish translator,
because the server action validates with the Polish default.

**Contract**: `accountCredentialsSchema` becomes `buildAccountCredentialsSchema(translator = POLISH_ACCOUNT)`,
with an exported default instance for the action. `password.ts` follows the same pattern.

#### 4. Action errors on this page

**File**: `lib/actions/account-credentials.ts`, `lib/constants/worker-lock.ts`, `lib/actions/worker-expense-drafts.ts`, `lib/constants/expense-drafts.ts`, `src/components/forms/hooks/use-form-submit.ts` (or wherever the form error toast is raised)

**Intent**: Each failure these actions return carries a `messageKey`, while Polish `error` text stays
as is for Polish viewers. The shared submit error toast routes through `failureMessage(locale, failure)`
once, so every form gets translated failures for free. Polish is unchanged, because `failureMessage`
returns `error` verbatim for `pl`.

**Contract**: The `messageKey` values are new `notices` keys. `loginRefusalMessage` keeps its Polish
return and gains a keyed variant, because the login page reads it too.

### Success Criteria:

#### Automated Verification:

- New DOM spec `src/__tests__/components/worker-expenses/expense-draft-dialog-language.test.tsx`:
  under `AppLanguageProvider locale="uk"` the dialog's title and submit button render the `uk`
  strings, and without a provider they render today's Polish.
- Existing specs for these components pass unchanged:
  - `src/__tests__/lib/actions/account-credentials.db.test.ts`
  - the account-credentials form spec, if present
  - the worker-expense spec, if present.

#### Manual Verification:

- As a worker set to Українська, the page's info rows, all four sections, the „Zmień dane logowania”
  dialog (labels, validation messages, a wrong-password error) and the expense-draft dialog read in
  Ukrainian. Amounts show `1 234,56 zł`.
- The same worker set to Русский: same screens in Russian.
- A manager set to Polski sees the page exactly as before.

---

## Phase 4: Translate the shared transfers stack

### Overview

This covers about 105 strings in components shared with `/kasa/[id]`, `/inwestycje/[id]`, the
manager dashboard and `/raporty`. They are translated in place. A Polish viewer sees no change.

### Changes Required:

#### 1. Column factory builds headers per translator

**File**: `src/components/tables/transfers.tsx`, `src/components/transfers/transfer-data-table.tsx`

**Intent**: `allColumns` is built at import time. Move its construction inside `getTransferColumns`,
with an optional translator defaulting to `POLISH_TRANSFERS`. `TransferDataTable` passes
`useTranslation('transfers')`. `columnLabel` feeds print and the column toggle, so those follow for free.

**Contract**: `ColumnOptionsT` gains `translator?`. The cached translator has a stable identity per
locale (`translations.ts:79-80`), so the React Compiler memo holds.

#### 2. Transfer label text helpers

**File**: `src/lib/transfers/transfer-text.ts`

**Intent**: `transferTypeText` / `transferPaymentMethodText` / `transferVatPlaneText` take an optional
translator. The constant maps in `src/lib/constants/transfers.ts` stay untouched.

**Contract**: The new parameter defaults to the Polish behaviour, so existing callers (sheet sync,
print) keep it.

#### 3. Filters, pagination, column toggle, print, archive

**File**: `transfers/transfer-filters.tsx`, `filters/{filter-multi-select,filter-select,date-range-picker,date-filter-button,column-toggle}.tsx`, `ui/{column-toggle-menu,column-order-dialog,pagination-footer,url-pagination}.tsx`, `lib/constants/months.ts` consumer, `transfers/{print-transfers-button,invoice-download-button,invoice-cell,note-popover}.tsx`, `lib/transfers/build-transfers-print-html.ts`, `hooks/use-file-archive.ts`, `lib/media/file-archive.ts`, `tables/data-table/empty-row.tsx` callers

**Intent**: A primitive with a bare literal reads `useTranslation('common')` (or the relevant
namespace) in place. Where a primitive already has a Polish-default label prop, the transfers callers
pass the translated label.
- `DateFilterButton`'s `date-fns` locale follows the context, mapped `pl`/`uk`/`ru` → the matching
  `date-fns/locale`.
- `MONTHS` gets a dictionary-backed lookup.
- The archive toast's `pluralize` becomes `translatePlural`.
- The print HTML takes `lang` and the translated title.

**Contract**: New `transfers` and `filters` namespaces, plus `common` additions. Module-level
constants keep a Polish default.

### Success Criteria:

#### Automated Verification:

- New DOM spec `src/__tests__/components/transfers/transfer-data-table-language.test.tsx`: under
  `locale="uk"`, the column headers, „Filtry” and the pagination summary render in `uk`. Without a
  provider, they are byte-identical to today's Polish.
- Existing Polish-asserting specs pass unchanged:
  - `src/__tests__/transfer-table.test.ts`
  - `src/__tests__/components/filters/filter-multi-select.test.tsx`
  - every other spec found by `grep -rl "Filtry\|Wyczyść filtry\|wyników" src/__tests__`.

#### Manual Verification:

- As a worker set to Українська, on your own page at 390px: the transfers headers, filters (Kasa,
  Inwestycja, Kategoria, the date picker and its month names), pagination, the column-order dialog,
  „Drukuj” (the printed page title) and the invoice-archive toast read in Ukrainian.
- As a manager set to Polski, `/kasa/[id]` and `/inwestycje/[id]` transfer tables look exactly as before.

---

## Phase 5: Translate media/upload and the shell

### Overview

This covers about 41 media/upload strings and about 18 shell strings: the menu, logout, theme and
refresh buttons, and the error and not-found pages.

### Changes Required:

#### 1. Media and upload

**File**: `lib/media/wording.ts` consumers, `dialogs/media-preview-dialog.tsx`, `ui/file-input.tsx`, upload plumbing (`upload-ids.ts`, `client-upload.ts`, `validate-upload-file.ts`, `blocked-files-message.tsx`, `use-file-pick-ingest.ts`, `use-media-upload.ts`, `media-upload-dialog.tsx`)

**Intent**: `INVOICE_PREVIEW_LABELS` / `INVOICE_ARCHIVE_COPY` become dictionary entries served by a
small hook (for example `useInvoiceLabels()`), with the Polish constants kept as the default for
non-React callers. Literal-bearing primitives read the context.

**Contract**: New `media` namespace.

#### 2. Shell

**File**: `components/nav/{mobile-nav,sidebar,theme-toggle,refresh-data-button,logout-button}.tsx`, `src/app/(frontend)/{error,not-found}.tsx`

**Intent**: Replace literals with `useTranslation('shell')`.
- `not-found.tsx` is a server component outside the page. It reads `fetchUserLanguage` from the
  JWT user, or is made a client component reading the context: pick whichever keeps it inside the
  layout's provider.
- The role badge uses the dictionary role names.

**Contract**: New `shell` namespace. `ROLE_LABELS` is untouched.

### Success Criteria:

#### Automated Verification:

- New DOM spec `src/__tests__/components/nav/mobile-nav-language.test.tsx`: under `locale="ru"`,
  the drawer's logout and theme labels render in `ru`. Without a provider they render Polish.
- Existing media, upload and nav specs pass unchanged.

#### Manual Verification:

- As a worker set to Українська, on a phone: open the drawer, where the logout, theme and refresh
  labels and the role badge are Ukrainian.
- Upload an invoice page to a draft: the picker placeholder, a blocked-file message and the preview
  dialog's labels are Ukrainian.
- Open a nonexistent URL: the not-found page is Ukrainian.
- As a manager set to Polski: the sidebar, drawer and upload dialogs are unchanged.

---

## Testing Strategy

### Unit / integration

- Phase 1 action, DB spec, TDD (`/10x-tdd`): the stored value and the session-bound account.
- `storedLanguageSchema` gets a unit case in the existing worker-schema spec.

### DOM

- One "with provider vs without" spec per converted surface (Phases 3–5). The without-provider half
  is the regression guard for management screens: it must equal today's Polish.
- The switch spec pins the device-key overwrite and the failure path.

### Test plan

Before Phase 1, extend `context/foundation/test-plan.md` via `/10x-test-plan` with two i18n risks:
- „a translated shared component changes what a Polish viewer sees”;
- „the account language and the report's device choice disagree”.
Anchor the specs above on them.

### Manual Testing Steps

The per-phase Manual Verification bullets are rolled into `context/foundation/manual-checks.md` §
EX-996 at the end of the run.

## Performance Considerations

`AuthenticatedShell` gains one awaited, cached read per full request (a data-cache hit after the
first). Client navigations inside the layout don't re-run it. No new client bundle beyond the
dictionary entries, which already ship with `useTranslation`.

## Migration Notes

None. `users.language` already exists, and no schema changes.

## Whole-tree Gate

Run **once**, after the final phase.

- Type checking passes: `pnpm typecheck` (also proves `uk`/`ru` cover every new key)
- Linting passes: `pnpm lint`
- Full unit + DOM suite passes: `pnpm test`
- Build succeeds: `pnpm build`

## References

- Research: `context/changes/2026-10-05-worker-page-language/research.md`
- Self-service action template: `src/lib/actions/account-credentials.ts`
- Report provider/switcher: `src/components/kosztorys/worker-report/{translations-provider,language-switcher}.tsx`
- Prior i18n change: `context/archive/2026-10-01-worker-report-translations-ua/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Account language plumbing

#### Automated

- [x] 1.1 account-language DB spec passes
- [x] 1.2 worker-schema spec passes with the storedLanguageSchema case

### Phase 2: The switch, the report key, the investment link

#### Automated

- [ ] 2.1 account-language-select DOM spec passes
- [ ] 2.2 moved translations-provider spec passes
- [ ] 2.3 transfer-table spec covers the plain-text „Inwestycja” for EMPLOYEE

### Phase 3: Translate the worker page's own components

#### Automated

- [ ] 3.1 expense-draft dialog language DOM spec passes
- [ ] 3.2 existing credentials / worker-expense specs pass unchanged

### Phase 4: Translate the shared transfers stack

#### Automated

- [ ] 4.1 transfer-data-table language DOM spec passes
- [ ] 4.2 existing Polish-asserting transfers/filters specs pass unchanged

### Phase 5: Translate media/upload and the shell

#### Automated

- [ ] 5.1 mobile-nav language DOM spec passes
- [ ] 5.2 existing media/upload/nav specs pass unchanged
