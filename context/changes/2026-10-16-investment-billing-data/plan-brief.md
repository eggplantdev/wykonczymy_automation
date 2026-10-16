# Investment billing data — Plan Brief

> Full plan: `context/changes/2026-10-16-investment-billing-data/plan.md`

## What & Why

Investments get a structured site address (kod pocztowy, miejscowość, kraj) and an optional „Dane do
umowy / faktury” block (osoba prywatna or firma, plus a billing address). The upcoming „Umowa”
dialog prefills from it instead of asking for the client's details every time.

## Starting Point

One free-text `address` plus phone, email and contact person. Existing addresses are mixed-format and
won't be split — the owner fixes them by hand.

## Desired End State

The add/edit investment form has the new fields (all optional); `/inwestycje/[id]` shows the joined
site address and, when filled, „Zamawiający” and „Adres do umowy”.

## Key Decisions Made

| Decision           | Choice                                               | Why                                                       |
| ------------------ | ---------------------------------------------------- | --------------------------------------------------------- |
| Existing addresses | No data migration                                    | Free text isn't splittable; owner migrates manually       |
| PESEL / ID         | Not stored                                           | Most sensitive field; contract leaves a blank line        |
| Company fields     | Nazwa, NIP, osoba reprezentująca                     | Enough for invoice + contract; no REGON/KRS               |
| Client entity      | Group on the investment                              | Repeat clients are rare; a Klienci collection is overkill |
| Billing address    | „Taki sam jak adres inwestycji” checkbox, default on | Standard checkout pattern                                 |
| Read path          | Ride the notes split (`fetchInvestmentDetails`)      | Keeps `InvestmentRefT`, shipped everywhere, lean          |
| Validation         | None on NIP / kod                                    | All optional, country varies                              |

## Scope

**In scope:** columns + migration, schema/form, detail-page read and InfoList rows.

**Out of scope:** the „Umowa” dialog, list table, leads promotion, Protokół odbioru changes.

## Phases at a Glance

| Phase                           | What it delivers                            | Key risk                                                 |
| ------------------------------- | ------------------------------------------- | -------------------------------------------------------- |
| 1. Data model                   | Columns, enum, migration, regenerated types | Hand-written migration column names must match Payload's |
| 2. Form, read path, detail view | Editable fields + display                   | Form length — sectioned with a FieldSet                  |

**Prerequisites:** none. **Estimated effort:** one session.

## Open Risks & Assumptions

- Additive migration → human runs `pnpm db:migrate:prod` before pushing.

## Success Criteria (Summary)

- Investment saves with all new fields blank or filled.
- Detail page shows the full address and the contract/invoice data once entered.
