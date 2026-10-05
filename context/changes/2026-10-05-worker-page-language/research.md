---
date: 2026-10-05T16:55:44+02:00
researcher: Claude (Opus 5.5)
git_commit: 530f8713
branch: staging
repository: wykonczymy
topic: "EX-996 — the worker's own /pracownicy/[id] in uk/ru: a current-language switch and a self-set default language"
tags: [research, i18n, worker-page, users-language, translations-provider, server-actions]
status: complete
last_updated: 2026-10-05
last_updated_by: Claude (Opus 5.5)
---

# Research: EX-996 — worker page language

**Date**: 2026-10-05T16:55:44+02:00
**Git Commit**: 530f8713 · **Branch**: staging · **Repository**: wykonczymy

## Research Question

On their own `/pracownicy/[id]`, the account's owner (an EMPLOYEE) gets two separate controls:
„Domyślny język” (saved on the account, `users.language`) and „bieżący język” (changes only what is
shown now, like the switcher on the worker report / „Podgląd pracownika”). The page itself is
localized to uk/ru. What exists, what has to be built, and where the seams are.

## Summary

- **Default-language write is small and fully patterned.** EMPLOYEE cannot REST-update `users`
  (EX-989 closed it), so it is one hand-wired self-service action modelled on
  `changeOwnCredentialsAction` — `requireAuth(ROLES)`, account id from the session, the existing
  `'pl'`→`null` transform, `['users']` revalidation. Every cached reader of `users.language`
  refreshes off that tag; the `/z` report link reads it uncached.
- **The i18n engine is ready; the page is not.** `pl/uk/ru` dictionaries, `translate` /
  `createTranslator` / `translatePlural`, `useTranslation`, and a provider whose context **defaults
  to Polish when absent** all exist. But the worker page has ~265 hard-coded Polish strings: ~95 in
  files only this page uses, ~170 in shared code (transfers table stack ~105, media/upload ~41,
  shell ~18).
- **The page is server-rendered.** Only `AccountCredentialsDialog` (and the client islands inside
  the transfers section / expense drafts) are client components. A localStorage-only „bieżący
  język” — which is how the existing switcher works — cannot reach the server sections. The current
  locale has to be either carried to the server (cookie / search param) or the translated server
  sections must take a `locale` prop resolved on the server.
- **Two existing behaviours collide with the new switches**: the report link's device-stored
  choice beats a newly saved default, and „Podgląd pracownika” opens in Polish against an owner
  decision from 2026-10-01.
- **Unrelated bug found**: the „Inwestycja” column in the transfers table links an EMPLOYEE to the
  management-only `/inwestycje/[id]`.

## Detailed Findings

### 1. Default language — write path

- `users.language` is a text field, not in the JWT, with no field access (`src/collections/users.ts:86-94`).
  Its `validate` accepts `'pl'`, so storing `'pl'` instead of `null` would be possible — the action
  must reuse the canonical transform.
- That transform is inline in `src/components/forms/worker-form/worker-schema.ts:30-33`;
  `worker-form.tsx:62` duplicates the reverse mapping for the prefill. Lifting it to a named export
  in `src/lib/i18n/languages.ts` lets both the management form and the new action share it.
- REST update is closed to EMPLOYEE (`canUpdateUser`, `src/access/index.ts:46-52`), and
  `protectedAction` is management-only → the action is hand-wired like
  `changeOwnCredentialsAction` (`src/lib/actions/account-credentials.ts`):
  `requireAuth(ROLES)` → `runAuthorizedHandler` (`src/lib/actions/run-action.ts`), id from the
  session, never an argument. No current password — a language is not a credential.
- Hooks on the update: `guardUserUpdate` refuses a trashed account (management wording, unreachable
  for a logged-in worker in practice); `guardDefaultRegister` doesn't fire (field untouched);
  `afterChange` revalidates `collection:users`. A deactivated account is not refused — irrelevant,
  it can't log in (EX-918).
- Readers of `users.language`:
  - `fetchReferenceData` (`src/lib/queries/reference-data.ts:184-196`), tagged `users` — the page's
    „Domyślny język” row, the PDF, the management edit-dialog prefill. Refreshed by `['users']`.
  - Do **not** read `fetchReferenceData` inside the action before the write — React `cache()`
    staleness (`reference-data.ts:49-52`); use `payload.findByID` if a read is needed.
  - The `/z` report link resolves the language uncached via `readReportShare`
    (`src/lib/queries/worker-report-page.ts:44`).

### 2. Current language — existing switcher

- `TranslationsProvider` (`src/components/kosztorys/worker-report/translations-provider.tsx:14-36`):
  `usePersistedEnum('worker-report-lang:${workerId}', LANGUAGES, initialLocale)` — localStorage per
  worker. Precedence: in-session choice > stored device choice > `initialLocale`
  (`users.language ?? 'pl'`), pinned by `translations-provider.test.tsx:45`. Server snapshot is
  `initialLocale`, so a stored choice can flash. Sets `document.documentElement.lang` in an effect
  (lines 26-29).
- `LanguageSwitcher` (`src/components/kosztorys/worker-report/language-switcher.tsx`):
  `SimpleSelect variant="toolbar"` over `LANGUAGES` with `LanguageLabel` flags; at 390px the name is
  visually hidden via `data-slot=language-name`.
- Mounted only in `WorkerReportView`, used by `/z/[investment]/[name]/[token]` and
  `(share)/podglad-pracownika/[worker]/[id]`. A second consumer on `/pracownicy/[id]` moves both out
  of `kosztorys/worker-report/` under the consumer-count rule (AGENTS.md → Important Directories).
- **Collision A:** once a device has a stored `worker-report-lang:<id>`, a newly saved default does
  not show on the `/z` link on that device. If „bieżący język” on `/pracownicy/[id]` shares that key,
  the two pages move together; if not, they diverge.
- **Collision B:** „Podgląd pracownika” hard-codes `DEFAULT_LANGUAGE`
  (`src/lib/queries/worker-report-page.ts:74`), against the owner decision that the preview opens in
  the worker's language (`context/archive/2026-10-01-worker-report-translations-ua/change.md:70-71`);
  the later `context/changes/2026-10-05-worker-single-view/plan.md:192-194` specified Polish.

### 3. i18n infrastructure

- `src/lib/i18n/languages.ts` — `LANGUAGES`, `DEFAULT_LANGUAGE='pl'`, `languageSchema`,
  `LANGUAGE_LABELS`, `isLanguage`, `toLanguage`.
- `src/lib/i18n/translations.ts` — `getTranslations`, `translate`, `translatePlural`
  (`Intl.PluralRules`, lines 49-64), `createTranslator` (cached per locale, lines 79-80 — stable
  identity for the React Compiler), `POLISH_GRID` default-parameter pattern (lines 98-99, used at
  `src/lib/kosztorys/stage-label.ts:9`, `header-tips.ts:63`).
- Dictionaries `pl/uk/ru.ts`, namespaces `common`, `notices`, `report`, `grid`. `uk`/`ru` are typed
  `TranslationsT = typeof pl` — a missing or extra key fails typecheck. No namespace for the worker
  page yet.
- `src/hooks/use-translation.ts:14-17` — `I18nContext` defaults to Polish outside a provider and never
  throws; shared management components already rely on that.
- `src/lib/i18n/failure-message.ts:15-21` — server-action failures translated via `messageKey` or a
  code-based generic sentence. Worker-page actions set no `messageKey` today.
- Formatting is deliberately `pl-PL` (`formatPLN`, `formatPLDate`); `formatPLDateTime` takes a locale
  for wording only (`src/lib/utils/format-date.ts:18`). Polish-only leftovers: `date-fns` `pl` in
  `DateFilterButton`, `MONTHS` (`src/lib/constants/months.ts`), `polish-plural.ts` in the archive toast.

### 4. String inventory of `/pracownicy/[id]` (EMPLOYEE view)

S = server, C = client.

| Area                                                                                                                               | Files                                                                                                                                                                         | S/C | Consumers                                               | ~Strings |
| ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------------------------------------------------------- | -------- |
| Page info rows + section title                                                                                                     | `src/app/(frontend)/pracownicy/[id]/page.tsx:65-74,96`                                                                                                                        | S   | this page                                               | 9        |
| Credentials dialog + form + schema + action errors                                                                                 | `dialogs/account-credentials-dialog.tsx`, `forms/account-credentials-form/*`, `lib/schemas/password.ts`, `lib/actions/account-credentials.ts`, `lib/constants/worker-lock.ts` | C/S | this page (lock msgs also login)                        | 19       |
| Owned registers / held equipment / investments                                                                                     | `users/owned-registers-section.tsx`, `equipment/held-equipment-section.tsx`, `users/worker-investments-section.tsx`                                                           | S   | this page                                               | 16       |
| Expense drafts (section, dialog, pages cell, delete, badge, action errors)                                                         | `worker-expenses/*`, `lib/actions/worker-expense-drafts.ts`, `lib/constants/expense-drafts.ts`                                                                                | S/C | this page (+ badge in manager list)                     | ~51      |
| Transfers table stack (columns, type/method labels, filters, date picker, column toggle/order, pagination, print, invoice archive) | `tables/transfers.tsx:37-219`, `transfers/*`, `filters/*`, `ui/pagination-*`, `lib/constants/transfers.ts`                                                                    | C   | kasa/[id], inwestycje/[id], manager dashboard, /raporty | ~105     |
| Media / upload                                                                                                                     | `lib/media/wording.ts`, `dialogs/media-preview-dialog.tsx`, upload plumbing, `ui/file-input.tsx`                                                                              | C   | all upload surfaces                                     | ~41      |
| Shell (mobile nav, sidebar, theme/refresh/logout, error, not-found, `<html lang="pl">`)                                            | `components/nav/*`, `app/(frontend)/layout.tsx:35`, `error.tsx`, `not-found.tsx`                                                                                              | C/S | every page                                              | ~18      |

Stays Polish because it is data: worker / investment / register / equipment names, category names
(DB rows), transfer descriptions, notes.

### 5. Seams for threading the locale

1. **Client subtree:** mount a provider around the page body only for the owner's own view. Every
   `useTranslation` under it localizes; management screens get no provider and stay Polish untouched.
2. **Server sections:** single-consumer server components take a `locale` prop and call
   `translate(locale, ns, key)` — the pattern of `src/app/(share)/z/[investment]/[name]/[token]/page.tsx:18`.
   This requires the server to know the **current** locale, not just the default — the crux of the
   „bieżący język” design (see Open Questions).
3. **Module-level constants:** `POLISH_<ns>` default-parameter pattern. `getTransferColumns`
   (`tables/transfers.tsx:227`) is already a factory, but `allColumns` (line 37) builds headers at
   import; move construction inside the factory with an optional translator. The constant maps in
   `src/lib/constants/transfers.ts` must stay Polish (sheet sync + Payload graph read them eagerly);
   `transferTypeText` & co. take an optional translator instead.
4. **Shared primitives:** those with a Polish-default label prop (`ConfirmDialog`, `closeLabel`,
   `FileInput`, `FormFooter`, `EmptyRow`, pagination labels, `MediaPreviewButton labels`,
   `useFileArchive`) get translated labels from the caller; those with bare literals
   (`column-toggle-menu`, `column-order-dialog`, `url-pagination`, `pagination-footer`,
   `filter-multi-select`, `filter-select`, `date-range-picker`, `date-filter-button`, `mobile-nav`)
   read `useTranslation('common')` in place — Polish without a provider.
5. **Action errors:** `messageKey` + `failureMessage`; routing `use-form-submit`'s error toast
   through it once covers every form. Zod messages are module-level → schema factory taking the
   translator.
6. **Shell:** outside the page's provider. Layout reads `getCurrentUserJwt()` (id/email/name/role,
   `src/lib/auth/get-current-user-jwt.ts:52`); `users.language` is not in the JWT
   (`users.ts:89`). Localizing it needs a cookie, `saveToJWT` (applies only after re-login), or a DB
   read in the layout. ~6 visible strings on a phone.

## Code References

- `src/app/(frontend)/pracownicy/[id]/page.tsx:40,65-74,78-83,95-110` — `isOwnPage`, info rows, button row, transfers config
- `src/collections/users.ts:86-94` — `language` field
- `src/access/index.ts:46-52` — `canUpdateUser` (EMPLOYEE closed)
- `src/lib/actions/account-credentials.ts` — self-service action template
- `src/lib/actions/run-action.ts` — `runAuthorizedHandler`
- `src/components/forms/worker-form/worker-schema.ts:30-33` — `'pl'`→`null` transform
- `src/lib/queries/reference-data.ts:49-52,184-196` — cache caveat, `users`-tagged worker read
- `src/lib/queries/worker-report-page.ts:44,74` — report link language; preview hard-coded Polish
- `src/components/kosztorys/worker-report/translations-provider.tsx:14-36` — provider + localStorage key
- `src/components/kosztorys/worker-report/language-switcher.tsx` — switcher
- `src/hooks/use-translation.ts:14-17` — Polish fallback context
- `src/lib/i18n/translations.ts:49-64,79-80,98-99` — plural, cached translator, `POLISH_GRID`
- `src/lib/i18n/failure-message.ts:15-21` — action failure translation
- `src/components/tables/transfers.tsx:37,85-95,227,285-295` — eager headers, investment link, factory, register-link strip
- `src/app/(frontend)/layout.tsx:35` — `<html lang="pl">`

## Architecture Insights

- **Provider-with-Polish-fallback** is the load-bearing pattern: shared components can be made
  translatable in place without touching any management screen, because absent a provider they
  render exactly what they render today.
- **Server/client split decides the „bieżący język” design.** The existing switcher is a pure client
  concern on a client-rendered report. `/pracownicy/[id]` is server-rendered, so the switch is either
  a cookie (server reads it, the whole page — and the shell — can follow it, no flash) or the page's
  server sections move to client components (bigger diff, flash on load, as on `/z` today).
- **Dictionary typing** (`typeof pl`) makes partial translation impossible to ship silently — every
  key added for the page must exist in uk and ru.
- Sheet sync and the Payload CLI graph read the Polish constant maps directly; translation goes
  around them (optional translator), never through them.

## Historical Context (from prior changes)

- `context/archive/2026-10-01-worker-report-translations-ua/change.md:70-76` — preview opens in the
  worker's language; the logged-in app was out of scope, "can be translated later with the same
  dictionaries"; ~90% of the crew is Ukrainian.
- `context/changes/2026-10-05-worker-single-view/plan.md:192-194` — specified Polish for „Podgląd
  pracownika”, which is what the code does.
- `context/changes/2026-10-05-worker-self-credentials/change.md` — EX-989: self-service gate outside
  `protectedAction`, REST self-update closed.
- AGENTS.md — "Polish UI, English code"; `/pracownicy/[id]` for an EMPLOYEE is the EX-985 phone-scope
  exception (checked at 390px).

## Related Research

- `context/archive/2026-10-01-worker-report-translations-ua/`
- `context/changes/2026-10-05-worker-single-view/`
- `context/changes/2026-10-05-worker-self-credentials/`

## Open Questions

**Resolved by the owner 2026-10-05 — see `change.md` decisions 1–7.** There is one switch,
„Domyślny język”, saved on the account. The page reads `users.language` on the server, so no cookie
is needed and no sections move to the client: the server sections take `locale = users.language ?? 'pl'`,
and the client subtree gets a provider with the same value. Saving writes the account and also
overwrites `worker-report-lang:<id>` on that device. „Podgląd pracownika” stays Polish. The whole
page is translated. Amounts and dates stay `pl-PL`. A manager sees the switch on their own page.
The original questions are kept below for the record.

Business decisions for the owner:

1. **Does „bieżący język” stay on the device between visits, or reset to „Domyślny język” every
   time?** And is it the same choice as on the worker's report link (switch it on one, the other
   follows)?
2. **When the worker saves a new „Domyślny język”, does it also replace a „bieżący język” the device
   remembers?** Today on the report link a remembered choice wins over the account's language.
3. **„Podgląd pracownika”: worker's language or Polish?** The 2026-10-01 decision says the worker's
   language; the code (per the 2026-10-05 plan) opens Polish.
4. **How much of the page in this change?** The page's own sections + credentials + expense drafts
   (~95 strings, files only this page uses), or also the transfers table, filters, upload dialogs
   (~170 strings shared with management screens, which stay Polish), and the menu/logout (~6 on a phone)?
5. **Kwoty i daty** — stay in Polish format (`1 234,56 zł`, `dd.mm.rrrr`) for uk/ru, as on the report
   link today?
6. **Who sees the switches** — only the worker on their own page, or also a manager on their own
   page (a manager is a worker too)?

Technical (decided in planning, not by the owner):

- Cookie vs client-rendered sections for carrying „bieżący język” to the server (follows from Q1/Q2).
  Owner, 2026-10-05: a load-time flash is acceptable, so "no flash" is not an argument for the
  cookie. The choice rests on reuse (the existing localStorage switcher) vs diff size (moving
  server sections to the client, or a `locale` prop resolved from a cookie).
- Shared home for `TranslationsProvider` / `LanguageSwitcher` once they have a second consumer.

Out of scope, found on the way:

- `src/components/tables/transfers.tsx:92` links „Inwestycja” to `/inwestycje/[id]` for every viewer;
  an EMPLOYEE taps into a management-only page. Lines 291-295 strip only the register links.
