# Ukrainian translations for the worker report surface — Plan Brief

> Full plan: `context/changes/2026-10-01-worker-report-translations-ua/plan.md`
> Research: `context/changes/2026-10-01-worker-report-translations-ua/research.md` (partly superseded by `change.md`)

## What & Why

About 90% of the crew is Ukrainian, so every link, PDF and form a worker gets must read in their
language. This change builds the i18n scaffolding and translates the first worker surface, the
report link `/zgloszenie-prac/…`. The rozpiska link `/p` and the worker PDF follow on the same
scaffolding.

## Starting Point

There is no i18n at all: `lang="pl"` is hard-coded and every string is inline Polish. Neither
kosztorys rows nor katalog entries have anywhere to keep a translated opis, and a worker has no
language.

## Desired End State

- A worker set to Українська opens their report link and reads the whole page in Ukrainian,
  translated opisy included (untranslated ones fall back to Polish). A switcher flips the page to
  Polski, and the choice is remembered per browser.
- Reports are still stored in Polish.
- The manager gets a hidden „Opis prac (UA)" column in the rozpiska and in the katalog, plus
  „nieaktualne tłumaczenie" / „bez tłumaczenia" problems.
- A re-runnable script fills the missing translations.

## Key Decisions Made

| Decision                         | Choice                                                                                        | Why                                                                            | Source          |
| -------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------- |
| Where translations of prace live | On the row and on the katalog entry, one value per language, copied like the opis             | Copy semantics; nothing re-checks against the katalog                          | change.md       |
| Identity                         | Stays Polish text; no pozycja → katalog link                                                  | Separate change, verdict "not now"                                             | change.md       |
| Out-of-date translation          | Kept; the manager is warned via its stored source text; the worker sees it as is              | Reverting the opis clears the warning by itself                                | change.md       |
| Storage                          | `description_translations jsonb` on both tables                                               | A new language is a key, not a migration                                       | Plan            |
| Worker language                  | Nullable text, validated in code; null = Polish                                               | A Payload select creates a Postgres enum, which needs a migration per language | Plan (research) |
| UI strings                       | Hand-rolled `useTranslation` like landing_26; context defaults to Polish                      | The manager's editor shares the grid and needs no provider                     | change.md       |
| „Wszystkie kolumny"              | Translated, not hidden                                                                        | `/p` and the PDF need the same headers anyway                                  | change.md       |
| Opis swap                        | Client-side, from the tree, per active language                                               | The switcher's choice lives in the browser                                     | Plan            |
| „Popraw literówki"               | A translation that was current stays current                                                  | A typo fix doesn't change meaning                                              | Plan (owner)    |
| „Zapisz do katalogu" (overwrite) | The pozycja's translation wins if present                                                     | The opis and translation come from one source                                  | Plan (owner)    |
| Filling                          | Re-runnable script, dry run by default, matched by Polish text, fills only empty translations | Old investments are still being imported                                       | change.md       |
| Sheet import                     | Copies the katalog translation for matching opisy                                             | Same as picking from the katalog                                               | change.md       |

## Scope

**In scope:**

- i18n core
- the worker's language and the switcher
- the report link in both views, its dialog, sending, history, notices and the 404
- the translation field on rozpiska and katalog, with copy rules
- the manager's columns and problems
- the fill script with a first Ukrainian file
- domain notes

**Out of scope:**

- `/p`, „Podgląd pracownika", the PDF (later slices)
- the logged-in app
- any AI call
- translating worker-typed „Prace spoza rozpiski"
- a Polish original under the opis
- stage, section and unit names as data

## Architecture / Approach

Language list (`src/lib/i18n/languages.ts`) → typed dictionaries `pl`/`uk` → a context that defaults
to Polish → `useTranslation(ns)` with `t`/`tp` (plurals via `Intl.PluralRules`). Pure column builders
take an optional dictionary through their existing options object. Server messages carry a
`messageKey`. The report page wraps itself in the provider (initial language from the worker,
overridable from localStorage), then swaps opisy from the row's `descriptionTranslations` before
the grid.

## Phases at a Glance

| Phase                   | What it delivers                                                              | Key risk                                                                        |
| ----------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1. Data model           | Columns + field threaded through every copy path                              | A forgotten copy path silently drops the field (guarded by the round-trip spec) |
| 2. Copy rules + editing | Katalog/import/szablon copy, overwrite and literówki rules, columns, problems | A katalog edit wiping translations through `CatalogueSeedItemT`                 |
| 3. Worker language      | „Język" on the worker, read by the link                                       | Stale `reference-data` cache (key bump)                                         |
| 4. i18n core            | Dictionaries, provider, plurals                                               | Polish plural parity with `pluralize`                                           |
| 5. Report link in UA    | Every string, notices, opis swap, switcher                                    | A shared builder leaking a dictionary into the manager's editor or print        |
| 6. Script + docs        | Fill script, first UA file, domain notes                                      | Loose matching; mitigated by exact-text match and fill-only-empty               |

**Prerequisites:** local DB current (`pnpm db:dump` + `pnpm db:import` before phase 6); 5435 test DB migrated.
**Estimated effort:** ~3–4 sessions.

## Open Risks & Assumptions

- Production must be migrated before the push (additive). A human runs it, and the fill script on
  prod after deploy.
- Raw-SQL fills skip cache tags. Flushing is a katalog or cell edit, documented in the script header.
- The column id `descriptionTranslation__<lang>` is persisted in hidden-column sets, so it must
  never be renamed after shipping.

## Success Criteria (Summary)

- A Ukrainian worker files a report entirely in Ukrainian, and the manager reviews it in Polish.
- An unset worker and the manager's editor are pixel-for-pixel unchanged.
- After the script runs, the katalog's „bez tłumaczenia (UA)" is (near) empty, and a second run fills nothing.
