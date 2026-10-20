# Investment „Wstępne informacje” — Plan Brief

> Full plan: `context/changes/2026-10-20-investment-initial-info/plan.md`

## What & Why

EX-1120. The kosztorys agent guesses rynek pierwotny / wtórny from Notatki, and a wrong guess swings
the whole draft: demontaże, skucia, which gładź. A „Rynek” field filled by people makes that a fact.
It lives in a new, extensible „Wstępne informacje” section, which the landing-page ankieta will fill later.

## Starting Point

The investment form has „Kontakt”, „Adres inwestycji” and „Dane do umowy / faktury” sections; the last
is a Payload `billing` group with flat columns, read by `fetchInvestmentDetails`. The agent's case inputs
hold only Notatki (`client-inquiry.md`).

## Desired End State

Add/edit dialogs have a collapsed „Wstępne informacje” section with „Rynek” (pierwotny / wtórny /
empty = unknown). Each new AI case gets `inputs/initial-info.md` with every field of the section, and
the method makes a set „Rynek” beat Notatki. „Kierownik budowy” no longer stretches across the form.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Storage | Payload `group` `initialInfo` → `initial_info_market` enum column | Same shape as `billing`; additive migration |
| Empty value | `null` = unknown, `''` in the form | Same as „Typ klienta” |
| Labels | One constants module (values + PL/EN labels + field labels) | The collection, form and AI scripts read one source |
| Placement | Right after „Kontakt”, collapsed | Next to the other lead sections; doesn't lengthen the dialog |
| Agent input | `inputs/initial-info.md`, rendered generically from the REST group | A new field shows up without a script change |
| Rounds | A round snapshots the section and flags changed lines | A market fixed between rounds is new information |
| Kierownik budowy | Wrapper in the form, not a `ui/` change | `Field` stretches children; `ui/select.tsx` is another agent's in-flight edit |

## Scope

**In scope:** the field + section, migration, details read, form, agent inputs (adopt + rounds),
ai-cases README rule, „Kierownik budowy” width.

**Out of scope:** the ankieta wiring, more fields, showing „Rynek” on the investment page, clearing a
chosen value, backfill.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data model | Column, enum, types, details read | Prod must be migrated before the push |
| 2. Form | Section + select, edit round-trip, select width | `''` reaching Payload's select |
| 3. AI agent | `initial-info.md` in cases and rounds, README rule | DRY check needs prod migrated first |

**Prerequisites:** none. Prod migration (`pnpm db:migrate:prod`) by a human before push.
**Estimated effort:** one session.

## Open Risks & Assumptions

- Existing investments read as unknown; the agent keeps guessing for them until someone fills „Rynek”.

## Success Criteria (Summary)

- „Rynek wtórny” saved in the edit dialog is there when the dialog reopens.
- The next adopted case has „Rynek: …” in its inputs, and the draft follows it over Notatki.
