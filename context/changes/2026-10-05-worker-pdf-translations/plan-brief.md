# Worker PDF in the worker's language — Plan Brief

> Full plan: `context/changes/2026-10-05-worker-pdf-translations/plan.md`
> Research: `context/changes/2026-10-05-worker-pdf-translations/research.md`

## What & Why

The worker's link speaks uk/ru; the PDF printed for him is still all Polish. This closes the last
translation gap in the worker view (EX-966). It also adds units of measure, which neither surface
translates yet. It lands before EX-949 (kartka → AI), which rebuilds the same PDF.

## Starting Point

The PDF is built client-side from the worker's cached projection. Its headers are hard-coded Polish
and shorter than the link's. The link translates through one pure function (`translateTree`) and
the grid dictionaries. Units pass through untranslated everywhere.

## Desired End State

„Drukuj PDF" for a Ukrainian or Russian worker prints his document in his stored language: link
wording in the headers, translated opisy, section names and units, and the rozliczenie footer.
Amounts and dates stay pl-PL. A Polish worker's PDF takes the link's (longer) header wording. The
link shows translated units, also in the „Prace dodatkowe" picker. The offer PDF is unchanged.

## Key Decisions Made

| Decision       | Choice                                                   | Why                                                                              | Source   |
| -------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------- | -------- |
| Data route     | The print read returns language + section translations   | One round trip, no cache-key bump, stays out of files another session is editing | Research |
| Header wording | Link's wording in every language, Polish included        | Paper and screen read alike. One label source                                    | Plan     |
| Language       | The worker's stored language only                        | Matches EX-948; the device switcher is per-phone                                 | Plan     |
| Units          | Fixed set translated on link and PDF; value stays Polish | ~97% of rows use 5 units; unknown units stay as typed                            | Plan     |
| Offer PDF      | Untouched (Polish defaults on shared modules)            | It is the client's document                                                      | Research |
| Podgląd        | Stays Polish                                             | Newer single-view decision                                                       | Research |

## Scope

**In scope:** unit dictionary + `translateTree`; „Prace dodatkowe" unit labels; print read returns
language + section translations; translated PDF headers, opisy, sections, units, section totals,
document kind, footer, `<html lang>`; Polish PDF header wording → link wording.

**Out of scope:** Podgląd language; the on-device language switcher; number/date formatting;
owner-facing toasts; units on the offer/editor/investor link; storing translated units.

## Architecture / Approach

Phase 1 puts `translateUnit` inside `translateTree`, so the link gets units first and the PDF gets
them for free. Phase 2 runs the same `translateTree` in `buildWorkerPrintHtml`, resolves headers
through `columnLabelForView` with the worker's grid translator, and gives shared print modules
optional parameters that default to today's Polish.

## Phases at a Glance

| Phase                         | What it delivers                                          | Key risk                                 |
| ----------------------------- | --------------------------------------------------------- | ---------------------------------------- |
| 1. Units on the link          | Translated j.m. in the grid and the extra-works picker    | uk/ru unit wording needs the owner's eye |
| 2. Worker PDF in his language | The whole PDF in uk/ru; Polish PDF takes the link wording | Longer headers on A4 landscape           |

**Prerequisites:** none — the dictionaries, `translateTree` and the stored language all exist.
**Estimated effort:** one session, two commits.

## Open Risks & Assumptions

- The uk/ru unit wording („пог. м", „компл.", „точ.", „год."/„ч") is proposed by the agent. The owner should confirm it.
- The longer link headers may wrap more on A4 landscape. This is checked by hand; the widths are not changed unless it overflows.
- `fetchReferenceData` covers the worker being printed. A missing ref falls back to Polish.

## Success Criteria (Summary)

- A Ukrainian worker's PDF reads in Ukrainian except untranslated opisy and amounts.
- A Polish worker's PDF headers match his link.
- The offer PDF and `offer.test.ts` are unchanged.
