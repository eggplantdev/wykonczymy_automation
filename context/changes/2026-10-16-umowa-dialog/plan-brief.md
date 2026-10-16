# Umowa dialog — Plan Brief

> Full plan: `context/changes/2026-10-16-umowa-dialog/plan.md`

## What & Why

A „Umowa” button on `/inwestycje/[id]` generates the client contract (from `umowa-wykonczeniowa.pdf`)
prefilled from „Dane do umowy” and the kosztorys. It works like the Protokół odbioru: you check the
fields, click „Generuj”, and print or save a PDF. Nothing is stored.

## Starting Point

- The Protokół odbioru already shows the full pattern: a pure HTML builder, a form with defaults, a print window, and „Edytuj dane inwestycji”.
- The investment has structured client and address data from the billing-data change.

## Desired End State

- The dialog prefills these fields, and every field is editable:
  - Numer (empty);
  - date (today) and Miejscowość („Warszawie”);
  - Zamawiający (name, PESEL, address);
  - adres inwestycji;
  - termin and czas trwania (empty);
  - osoby odpowiedzialne;
  - kwota netto (= „Wartość przedmiaru netto”).
- The fixed legal text is the PDF's, with its typos fixed.

## Key Decisions Made

| Decision            | Choice                                              | Why                                                    |
| ------------------- | --------------------------------------------------- | ------------------------------------------------------ |
| Kwota source        | Editor footer `columnTotalsForRows(...).plannedNet` | Same number the owner sees in the kosztorys            |
| When it loads       | On dialog open (server action + `use()`)            | No tree build on page views that never open the dialog |
| Client name/address | Shared helper, also used by the protocol            | One rule for „who is the client”                       |
| Print styles        | Shared base extracted from the protocol             | Page/margin rules (Safari trap) live once              |
| PESEL               | Dialog-only, hidden for Firma, never stored         | Owner decision                                         |
| VAT                 | Fixed „8%” text                                     | Owner: fixed for now                                   |
| Clauses             | Transcribed, typo-fixed only                        | Legal content is the owner's                           |

## Scope

**In scope:**

- the pure contract module, with specs;
- the two de-duplications;
- the on-demand przedmiar read;
- the dialog and the button.

**Out of scope:**

- storing contracts or numbering them;
- a VAT field;
- clause edits;
- a button in the editor;
- a logo.

## Phases at a Glance

| Phase | Delivers                                         | Key risk                                 |
| ----- | ------------------------------------------------ | ---------------------------------------- |
| 1     | Contract types/defaults/builder + shared helpers | Transcription drift from the PDF         |
| 2     | Przedmiar read, dialog, button on the page       | Promise lifecycle under `use()`/Suspense |

## Open Risks & Assumptions

- The PDF text is taken as authoritative. Fixes go only to typos and to „zwanym” in the singular.
- `getKosztorysTree` is uncached. That is acceptable for one load per dialog open at ~40 accounts.
