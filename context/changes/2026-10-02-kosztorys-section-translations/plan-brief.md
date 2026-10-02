# Section name translations (UA/RU) on the worker report link — Plan Brief

> Full plan: `context/changes/2026-10-02-kosztorys-section-translations/plan.md`
> Research: `context/changes/2026-10-02-kosztorys-section-translations/research.md`

## What & Why

EX-948 translated the opisy on the worker's report link, but section names stayed Polish, so a
Ukrainian or Russian crew still reads „Łazienka 2" and „Wyburzenia i demontaże" on every band.
This change translates section names on that link (EX-965). A manager must be able to fix a
translation in the app, without a deploy.

## Starting Point

The report page swaps opisy on the client, in one function, just before the grid. Section names pass
through it untouched. The whole vocabulary is ~22 names, almost all copied from the szablon, and
there is no section catalogue anywhere.

## Desired End State

A worker set to UA or RU sees every section band, every „Razem …" row and the search hits in their
language, numbers kept („Ванна кімната 2"). An untranslated name stays Polish. A manager opens
„Tłumaczenie sekcji…" from a section's menu and fixes the text. The fix applies on every rozpiska
with that name, future ones included.

## Key Decisions Made

| Decision        | Choice                                                                         | Why                                                                                         | Source    |
| --------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | --------- |
| Storage         | In the DB, editable in the app                                                 | A manager must fix it without a deploy                                                      | change.md |
| Shape           | One shared list keyed by the normalised name; nothing on the section row       | ~22 names cover every open investment; copy paths (restore, szablon, import) stay untouched | change.md |
| Numbers         | A standalone number anywhere is a placeholder; `230V` is text                  | „Łazienka 1 wanna" and „Łazienka 2 wanna" share one translation                             | change.md |
| Editing surface | „Tłumaczenie sekcji…" in the section menu (rozpiska + szablon)                 | The fix happens where the section is seen; no new page                                      | Plan      |
| Typing numbers  | The manager types real numbers; save refuses numbers that differ from the name | No special syntax; it catches typos and rules out swapped pairs                             | Plan      |
| „Problemy"      | No „bez tłumaczenia" entry                                                     | Most rozpiski never reach a UA/RU crew, the same as EX-948 for opisy                        | Plan      |
| First fill      | The seed sits in the migration and never overwrites                            | Production gets it with the migration a human runs anyway                                   | Plan      |
| Scope           | The report link only                                                           | `/p`, „Podgląd pracownika" and the PDF go to EX-966 on the same lookup                      | Plan      |

## Scope

**In scope:**

- the table and its seed
- the placeholder rules
- the cached read
- the manager action and dialog
- the swap on `/zgloszenie-prac/…`
- domain notes

**Out of scope:**

- `/p`, „Podgląd pracownika", the PDF (EX-966)
- etapy and units
- a „Problemy" entry
- a list page
- a fill script
- merging old szablon spellings
- any stale state

## Architecture / Approach

Raw table `kosztorys_section_translations` (`name_key` → `translations jsonb`) → a pure module
(`sectionNameKey`, `toSectionTemplate`, `renderSectionName`) → a tag-cached read of the whole list.

From there it splits:

- **Worker side:** the report page sends the list to the browser, and `translateTree` swaps section
  names next to the opisy.
- **Manager side:** the dialog fetches its one entry when it opens, and the save action expires the
  tag. Nothing new threads through the editor's props or context.

## Phases at a Glance

| Phase                      | What it delivers                                   | Key risk                                                                           |
| -------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1. Shared list + rules     | Table, seed, placeholder rules, cached read        | A seed key the normaliser never produces, so it silently misses (a spec guards it) |
| 2. Section menu dialog     | „Tłumaczenie sekcji…" with UA/RU, number check     | Rendering vs saving numbers disagree (one pure module owns both)                   |
| 3. Report link swap + docs | Translated bands, „Razem …" and search on the link | The switcher needs every language on the client (the whole list ships)             |

**Prerequisites:** local DB current (`pnpm db:import` if the dump is newer) to confirm the seed names;
5435 test DB migrated.
**Estimated effort:** ~1–2 sessions.

## Open Risks & Assumptions

- Production must be migrated before the push (additive). A human runs `pnpm db:migrate:prod`, and
  the preview DB needs `pnpm db:migrate:preview` after the merge.
- A name that shows up after the seed (a one-off or a new szablon spelling) stays Polish until a
  manager fills it in. That fallback is safe and expected.
- Until EX-966 lands, the same worker sees section names translated on the report link but Polish on
  `/p`.

## Success Criteria (Summary)

- A Ukrainian worker's report link shows section names in Ukrainian, room numbers intact.
- A manager's fix in the dialog shows on the worker's link on the next load, with no deploy.
- The sent report, the manager's review and every other surface are unchanged.
