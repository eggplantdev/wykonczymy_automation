# Katalog prac — Filtry / Problemy + raport użycia — Plan Brief

> Full plan: `context/changes/2026-09-28-catalogue-filters-and-usage/plan.md`
> Research: `context/changes/2026-09-28-catalogue-filters-and-usage/research.md`

## What & Why

`/katalog-prac` gains three things:

- the editor's „Problemy" and „Filtry" menus, plus a „j.m." filter (EX-863);
- a „Policz użycia" button showing in how many kosztorysy each praca is actually used (EX-873);
- the used works that the catalogue is missing, with „może chodzi o…" hints.

The goal is to clean up a 561-row cennik: find broken prices and stawki over the limit, and find
dead or missing prace.

## Starting Point

The table has search, Kategoria and „Dodaj pracę". The editor's filter machinery and the UI
primitives exist, but the registry is typed on rozpiska rows. The usage figures are one 2 ms SQL
read away. Matching must run in Node, because the typo folding lives only in TS.

## Desired End State

- „Problemy" lists: bez ceny j.m., stawka 0 zł per widok.
- „Filtry" filters by stawka source (kwota / mnożnik / auto) and by ponad / w granicy against the
  per-plane limit (65 % / 55,25 %). The filters persist.
- Chips under the toolbar name every active narrowing.
- After „Policz użycia" the page adds:
  - a „Kosztorysy" column;
  - an „Użycie" group (nieużywane / używane), which is not persisted;
  - a „występuje z inną j.m." marker;
  - the „Używane, a brak w katalogu" list.

## Key Decisions Made

| Decision       | Choice                                                                | Why                                                               | Source                      |
| -------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------- |
| „Used" pozycja | Przedmiar > 0 or an etap qty > 0                                      | a kosztorys carries the whole cennik at zero                      | Research (owner 2026-09-28) |
| Scope          | exclude szablon + kosz; wyceny count                                  | owner 2026-09-29                                                  | Research                    |
| Count unit     | distinct inwestycje („Kosztorysy")                                    | a counter's unit is its meaning                                   | Research                    |
| Last used date | none, anywhere                                                        | no trustworthy date on a pozycja                                  | Research (owner)            |
| Ceiling        | per plane, via one predicate `isCatalogueOverCeiling`                 | the red cell and the filter can't disagree                        | Research Q1                 |
| „W granicy"    | excludes auto and bez ceny                                            | auto has no share; the partition adds up                          | Research Q2 (owner: out)    |
| Count basis    | whole catalogue                                                       | a count never moves with other controls                           | Research Q3                 |
| Chip bar       | new `belowToolbar` slot on DataTable                                  | explicit, one line                                                | Research Q4                 |
| Persistence    | plain filters in localStorage; Użycie in React state only             | a restored „nieużywane" would filter by a figure that isn't there | Research Q5                 |
| Registry       | the catalogue's own small registry, not generalised from the editor's | the editor's is typed on rozpiska + etapy                         | Research                    |
| Model core     | not extracted                                                         | 2 lines per model; the params would equal the code                | Plan                        |
| Hints          | server-side in the read, shared scorer + `CandidateRow`               | reuse, not a copy                                                 | Research Q (list)           |
| Cache          | none for the usage read                                               | on a click; freshness is the point                                | Plan                        |

## Scope

**In scope:**

- shared engaged-id store, chip bar, `belowToolbar`;
- catalogue conditions, menus, j.m.;
- usage SQL, matching and query;
- usage column, marker, group and list;
- test-plan risk #14 and a domain-notes section.

**Out of scope:**

- wyłączników / włączników;
- presets and legacy sheets;
- fuzzy counting;
- a date column;
- the editor's catalogue dialog;
- schema changes.

## Architecture / Approach

The `lib/kosztorys/work-catalogue/` layer is pure and node-tested. It holds the condition registry,
counts, apply and usage building. `lib/db/catalogue-usage.ts` holds one statement.
`lib/queries/catalogue-usage.ts` holds the `'use server'` read behind `protectedAction`. The table
component chains: conditions → search → Kategoria → j.m. → deferred. It holds `usage` as nullable
client state that gates every usage surface.

## Phases at a Glance

| Phase              | What it delivers                                           | Key risk                                                              |
| ------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| 1. Shared plumbing | store / chip bar / slot / ceiling helper out of the editor | editor regressions; its specs guard it                                |
| 2. EX-863 menus    | Problemy, Filtry, j.m., chips on the catalogue             | cmdk label collisions across planes                                   |
| 3. Usage read      | SQL + matching + query                                     | the kosz exclusion is unverifiable on local data; a DB spec proves it |
| 4. Usage UI        | button, column, marker, Użycie group, missing list         | a late-appearing column vs persisted column order                     |
| 5. Docs            | domain notes, change.md correction                         | —                                                                     |

**Prerequisites:** local docker DB (5433) for manual checks; the `db-test` container (5435) for the
DB spec.
**Estimated effort:** ~2 sessions.

## Open Risks & Assumptions

- A column that appears only after the click may upset `DataTable`'s persisted order and visibility.
  The fallback is an always-present column showing „—".
- The toggle types may need to move to `components/filters/`, so catalogue files don't import from
  `kosztorys/editor`.

## Success Criteria (Summary)

- The owner can list every praca with a broken price, or over the limit, in one click, and the list
  agrees with the red cells.
- „Policz użycia" names the dead prace and the missing ones, counted in kosztorysy, with szablony
  and the kosz excluded.
