# Kosz — flota (EX-915) + sprzęt (EX-916) — Plan Brief

> Full plan: `context/changes/2026-10-01-kosz-floty-i-sprzetu/plan.md`
> Research: `context/changes/2026-10-01-kosz-floty-i-sprzetu/research.md`

## What & Why

A vehicle or an equipment item entered by mistake can't be removed from the app. This change adds
both as `/kosz` kinds — trash, restore, delete forever with the typed name, 30-day purge. They are
the first kinds with no blocker: the confirm warns about what will be lost instead of refusing.

## Starting Point

The `/kosz` machinery is ready (five kinds' worth of registry, query, purge, cron). Nothing outside
either module points at a vehicle or an item, and the DB cascades their history. Fleet has one read
chokepoint plus a badge; equipment has five readers. Duplicate plates and serials reach the toast as
a raw DB error. Kasa and pracownik each carry a near-identical trash button.

## Desired End State

„Usuń" on `/flota` and `/sprzet` rows, with warnings (reminders stop, N przeglądów / historia
przekazań go with it, where the item is now). A trashed row vanishes from listings, detail pages,
the worker card, the mails and the badges. `/kosz` gets „Flota" and „Sprzęt" sections with a
make/model (+ serial) line. Restore returns the row unchanged. A duplicate plate/serial is refused
with a sentence pointing to Kosz when the holder is trashed.

## Key Decisions Made

| Decision                     | Choice                                                                  | Why                                                                                | Source               |
| ---------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------- |
| Blocker                      | None — warnings only                                                    | Every vehicle has inspections; history loss is acceptable                          | Owner                |
| Freeze on a trashed row      | None                                                                    | Only a stale page can write; harmless, `trashedAt` unwritable                      | Owner                |
| Unique keys                  | Stay taken while trashed                                                | Freeing them moves the collision to „Przywróć"                                     | Owner                |
| Purge                        | 30 days or typed-name delete; history goes with it                      | One `/kosz` policy                                                                 | Owner                |
| Typed name                   | Registration for a car, name for an item                                | Registration is unique and what the owner reads; `detail` line disambiguates items | Plan (research rec.) |
| Warnings                     | In the trash confirm; status/count/location from the row already loaded | No extra fetch; `FleetRowT.inspectionCount` is the one new field                   | Plan (research rec.) |
| `/kosz` identification       | `TrashRowT.detail` line: make/model (+ serial)                          | Three „szlifierka" must be told apart                                              | Plan (research rec.) |
| Duplicate key                | Pre-check in create/update actions, naming Kosz for a trashed holder    | `createWarehouseAction` precedent                                                  | Plan (research rec.) |
| Trash button                 | One shared `TrashRowButton`; kasa + pracownik migrated                  | Four near-copies otherwise                                                         | Plan                 |
| `shapeTrashRows` signature   | One object instead of five positional arrays                            | Readability at five lists                                                          | Plan                 |
| Worker trash vs item history | Unchanged — the item's events keep pinning the worker until purge       | RESTRICT FK would refuse the worker's hard delete                                  | Plan (research)      |
| Cache keys                   | No bump                                                                 | Dataset shapes unchanged; the trash action expires the tags                        | Plan                 |
| E2E                          | Filed to `e2e-backlog` at the review gate                               | Same as EX-952                                                                     | Plan                 |

## Scope

**In scope:** the `trashed_at` column on both tables; every reader and both badges filtered; trash /
restore / delete forever / purge + cron steps; duplicate pre-checks; row buttons with warnings; the
two `/kosz` sections; the shared trash button; test-plan / manual-checks / umbrella docs.

**Out of scope:** a blocker or `beforeDelete` guard; an update freeze; loosening the worker trash;
media cleanup of orphaned attachments (`kosz-plikow`); detail-page trash buttons; an E2E spec.

## Architecture / Approach

Mirror the kasa kind inside `src/lib/fleet/` and `src/lib/equipment/`, stripped of every refusal:
trash is a single `trashedAt` write, delete forever is `payload.delete` (DB cascade takes the
history), purge goes through `purgeTrashedRows`. Hiding is a per-reader filter — there is no
reference-data split because nothing else names these rows.

## Phases at a Glance

| Phase                               | What it delivers                                                     | Key risk                                                 |
| ----------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------- |
| 1. Column and hide                  | Column on both tables; every reader + both badges skip a trashed row | A missed reader (the badges are the likely one)          |
| 2. Trash / restore / delete / purge | Actions, SQL, purge, cron steps, tag sets                            | Delete tag set missing the child tag → stale history     |
| 3. Duplicate plate / serial         | Readable refusals, Kosz named for a trashed holder                   | Update excluding its own id wrongly                      |
| 4. UI, `/kosz`, docs                | Row buttons + warnings, two sections, shared button                  | Regressing the kasa / pracownik buttons in the migration |

**Prerequisites:** kosz-pracownikow committed (cc07411e); local DB migrated from this tree.

**Estimated effort:** ~1–2 sessions across 4 phases.

## Open Risks & Assumptions

- Orphaned attachment files on delete forever — accepted, 0 attachments today.
- A stale open page can still add an inspection or a handover to a trashed row — accepted by the owner.

## Success Criteria (Summary)

- An `ACTIVE` car with inspections and an item held by a worker can both be trashed, restored and
  deleted for good; a trashed one appears nowhere but `/kosz`.
- A duplicate plate or serial gets a sentence, not a DB error.
- `/kasy` and `/pracownicy` trash buttons behave exactly as before.
