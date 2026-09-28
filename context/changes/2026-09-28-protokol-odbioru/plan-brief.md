# Protokół odbioru prac — Plan Brief

> Full plan: `context/changes/2026-09-28-protokol-odbioru/plan.md`

## What & Why

The owner needs a „protokół odbioru prac" to sign with the client on site. Today it's a blank
template filled by hand; the app already knows the client, the address, the executed work and the
money — so the protocol should come out of the kosztorys prefilled.

## Starting Point

The „Inwestor" menu already prints the offer through the browser print window. All settlement
figures (robocizna, materiały, wpłaty, pozostało do zapłaty) exist as pure functions behind the
„Podsumowanie" tab. Investment client data is sparse (address 35/138, osoba kontaktowa 9/138).

## Desired End State

„Inwestor → Protokół odbioru…" opens a prefilled, editable form with a read-only preview of the
scope and the netto settlement; „Generuj" prints the protocol (save as PDF); „Zaktualizuj dane
inwestycji" writes corrected client name/address back to the investment.

## Key Decisions Made

| Decision                              | Choice                                                                                       | Why                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Step 1 output                         | Dialog + print                                                                               | A form without output is a half-product; print mechanism exists     |
| Scope of work                         | Every pozycja with Pomiar z natury > 0, read-only                                            | Kosztorys stays the single source                                   |
| Settlement                            | Netto: Robocizna, Materiały, Suma, Wpłaty, (Strata), Pozostało                               | Same figures as „Podsumowanie", composed from its functions         |
| Client data write-back                | Separate „Zaktualizuj dane inwestycji" button                                                | Generating never silently edits the investment                      |
| Wykonawca                             | Hard-coded „Wykończymy"                                                                      | Always the same company                                             |
| Dropped from template                 | denwi footer, „Reprezentowany przez", „Inne osoby", „Kwota zatrzymana", pkt 7, contract line | Irrelevant to a small private-client business / no contracts in app |
| Rodzaj odbioru default                | „końcowy" when every Przedmiar is fully executed, else „częściowy"                           | Editable guess from data                                            |
| Termin zapłaty / Obniżenie / Rękojmia | date field / blank line / = data odbioru                                                     | Owner confirmed                                                     |

## Scope

**In scope:** menu item, prefilled dialog, scope + settlement preview, print HTML, investment
write-back button, shared logo-wait print helper.

**Out of scope:** persisting protocols, server PDF, contract fields, brutto figures, editing scope
or figures, wykonawca data in DB.

## Architecture / Approach

Pure functions in `src/lib/kosztorys/acceptance-protocol/` (defaults, scope, settlement, update
payload, HTML) → dialog in the editor's actions-provider pattern. Summary inputs missing from the
editor context are threaded body → toolbar → actions menu as one optional `protocolSource` prop
(not into the editor provider — EX-496).

## Phases at a Glance

| Phase              | What it delivers                                         | Key risk                                        |
| ------------------ | -------------------------------------------------------- | ----------------------------------------------- |
| 1. Protocol logic  | Defaults, scope, settlement, update payload + unit tests | Settlement drifting from „Podsumowanie"         |
| 2. Print HTML      | Trimmed template as HTML + test                          | Layout fidelity only checkable by printing      |
| 3. Dialog + wiring | Menu item, dialog, both buttons, shared print helper     | Partial update payload wiping investment fields |

**Prerequisites:** none. **Estimated effort:** ~1 session.

## Open Risks & Assumptions

- Dropping the contract line assumes the business signs no numbered contracts.
- `investments.name` as the Zamawiający fallback often includes the address — editable in the form.

## Success Criteria (Summary)

- A printed protocol whose rozliczenie equals „Podsumowanie" to the grosz.
- Header prefilled from the investment; only pen-fields left blank.
- Updating client data never touches other investment fields.
