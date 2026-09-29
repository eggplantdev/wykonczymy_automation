---
change_id: katalog-sprzetu
title: Tools and equipment catalogue — equipment register with employee/warehouse assignment, service and warranty
status: archived
created: 2026-09-01
updated: 2026-09-15
archived_at: 2026-09-15T12:40:05Z
branch: staging
worktree: null
---

## Notes

The owner wants to know: what equipment the company has, who holds it, whether it's sitting in
service, and when the warranty ends. The Fleet pattern (thing + deadlines + costs + event log)
carries over to equipment.

Most model rationale lives in code comments (no quantity field, derived location, free-text
`serviceProvider`, warehouse delete-guard, no mail after warranty expiry). What code doesn't say:

## Agreed scope (owner, 2026-09-03)

### Model

- **Two collections**: equipment + event log. Not three — handovers and service are one stream.
- **An event has NO "type" field — the target is the type.** An entry with `serviceProvider` IS a
  service entry; one with `holder`/`warehouse` is a handover. A `type` enum beside it would be a
  second source of truth for the same fact and the first thing to drift.
  **Risk to watch:** on-site repair (service with no movement) has no representation — a service entry
  always moves the item to the workshop. Deliberately out of scope; if it comes up, it enters as a
  fourth target ("on site"), never as a type enum.
- **One „Przekaż" action** — no issue/return pair, no "in transit" state. Returning to a warehouse is
  a handover whose target is the warehouse.
- **Lifecycle is its own field**: in use / retired / sold / lost / stolen. The end of an item's
  story, not a place. "Lost" + the log = we know who had it last.
- **No assignment (neither employee nor warehouse) is an alarm** — a data gap, not an equipment
  state. Holder-less states that raise no alarm: retired, sold, lost, stolen.
- **Identity**: own name required (it's what people search and click); serial number optional and
  unique when given (forcing it would block setting up the register — nobody retypes a hundred
  plates on day one). Name not unique — three „szlifierki" are fine.
- **Entity and its first log entry are created in ONE transaction**
  (`src/lib/db/with-payload-transaction.ts`). A break between the writes would leave equipment with
  no log — exactly the "location unknown" state the form's mandatory location exists to prevent.
- **The notification stamp sits on the EQUIPMENT, not the event** — in Fleet the deadline belongs to
  the event, here the warranty belongs to the thing. Hence changing `warrantyUntil` must reset the
  bookkeeping (`reset-warranty-bookkeeping.ts`), or an extended warranty never mails.
- **Status shipped with UI that reaches all five values.** Fleet shipped `RETIRED` without an edit
  dialog and the owner asked for it a week later.
- **Event attachments: schema only.** `attachments` (`hasMany` → `media`) is in the collection and
  migration because adding it later costs a second migration; forms and history don't touch it — a
  service invoice or warranty card goes in via `/admin` for now.

### Views

- **List** — one search field (name, serial, make, model), not a filter set. Scale unknown, so
  designed for large.
- **„Co ma Marek" sits on the EXISTING employee page** (`pracownicy/[id]/page.tsx`), next to payouts
  and transfers — not a new screen. "What does this person hold" is asked exactly where people
  already look at dismissal and settlement; a separate route would split one person across two
  addresses. First version: no actions — handovers happen from the equipment detail.
- **Warehouses get NO page of their own.** "What's at Kwiatowa" is the „gdzie jest" filter on the
  equipment list — same list, same query, one route fewer. The query is already parameterised by
  holder, so a warehouse card stays possible if ever needed.
- **Warranty: its own cell, not `DeadlineCell`** — that one renders „bezterminowo" from `exempt` and
  „brak danych" per inspection type, two concepts equipment doesn't have. Only `daysLabel` is shared.
  Thresholds 30 and 7 days, its own daily cron beside Fleet's.

### Out of scope (deliberately)

Employee confirmation of receipt — the only item that would pull the `EMPLOYEE` role into a module
that is entirely management's (like Fleet); a separate access surface and mobile screen. Also:
quantities and consumables, condition photos at issue/return, stocktaking, equipment cost allocated
to an investment, UDT / electrical inspection deadlines, QR stickers.

### Corrections after the second review-gate round (2026-09-04)

- **The „u kogo" column split into „Kto ma" + „Miejsce".** Sorting by holder in one column mixed
  people with warehouses and sorted names from two dictionaries. The „gdzie jest" filter STAYS
  single-axis — one dropdown with people and warehouses — so filter and columns model the same fact
  differently, on purpose: you filter by "where is it", you read "who" separately from "where".
- **A warehouse can be created from the form** („+ Nowy magazyn", `createWarehouseAction`), against
  the earlier "zero screens in the app". "It's not on the list" mid-entry threw the user out to
  `/admin` and lost the typed data. The dictionary still has no screen — just a button where the
  missing entry hurts.
- **Investment only under an employee** — the field shows only for the "employee" target, and the
  collection hook (`src/hooks/equipment/validate.ts`) nulls `investment` on any other target. The rule
  sits on the row, not just the form, because the list reads `investment_id` from the latest event
  unconditionally — an `/admin` entry would render "in the warehouse, on investment X" as fact.

**Naming trap**: `wToolsCoeff` / `ownToolsCoeff` on the investment are the labor **pricing** model
(with / without tools), not inventory — the shared word "narzędzia" doesn't mean a shared domain.
