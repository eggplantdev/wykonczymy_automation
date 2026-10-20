# One Default Supplier per Order Item — Plan Brief

> Full plan: `context/changes/2026-10-20-order-default-supplier-per-item/plan.md`

## What & Why

Big bags and containers come from separate companies, but the order settings hold one default
supplier — ordering a kontener preselects the big bag company. Each item kind gets its own default.

## Starting Point

The `order-settings` global has a shared supplier list, two prices and one `defaultSupplierId`. Prod runs
this code; its default is „Mariusz Big Bag”, and „Dariusz Kontener” is on the list.

## Desired End State

Switching „big bag” ↔ „kontener” in the order dialog preselects that kind's supplier, and the star
saves the default for the selected kind only.

## Key Decisions Made

| Decision            | Choice                                                  | Why                                                     |
| ------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| Model               | Two flat fields + `defaultSupplierKey` in `ORDER_ITEMS` | Mirrors the existing `priceKey`; no new mechanism       |
| Supplier list       | Stays shared, unfiltered                                | Option A — a default per kind is enough at 2–3 rows     |
| Data carry-over     | Old default → big bag; kontener empty                   | The migration can't know the kontener company           |
| Old column          | Kept now, dropped by a later migration                  | Keeps this migration additive — no broken deploy window |
| No default for kind | Fall back to the first supplier (as today)              | The name is visible; one star click fixes it            |

## Scope

**In scope:** global + migration, types, read mapper, both actions, pick step, specs.

**Out of scope:** per-supplier „what it delivers” tag, list filtering, dropping `default_supplier_id`.

## Phases at a Glance

| Phase                     | What it delivers                       | Key risk                                   |
| ------------------------- | -------------------------------------- | ------------------------------------------ |
| 1. Data model and actions | Per-kind defaults stored, set and kept | `updateGlobal` overwrite of the other key  |
| 2. Order dialog           | Per-kind preselection and star         | Stale `SaveAsDefaultButton` seed on switch |

**Prerequisites:** none. **Estimated effort:** one session.

## Open Risks & Assumptions

- A star click on prod between migrate and deploy lands on the old column and is lost (minutes).
- Someone must star „Dariusz Kontener” once after deploy.

## Success Criteria (Summary)

- Ordering a kontener texts the kontener company without a manual pick.
- Saving one kind's default never changes the other's.
