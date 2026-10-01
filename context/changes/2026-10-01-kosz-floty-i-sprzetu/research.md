---
date: 2026-10-01T13:52:44+02:00
researcher: Claude (Opus 5.5)
git_commit: d4869370
branch: staging
repository: wykonczymy
topic: 'Kosz: flota + sprzęt — trash a vehicle (EX-915) and an equipment item (EX-916)'
tags:
  [
    research,
    codebase,
    trash,
    kosz,
    soft-delete,
    fleet,
    vehicles,
    vehicle-inspections,
    equipment,
    equipment-events,
  ]
status: complete
last_updated: 2026-10-01
last_updated_by: Claude (Opus 5.5)
last_updated_note: 'Merged EX-916 (sprzęt) into this change — §10'
---

# Research: Kosz — flota (EX-915) + sprzęt (EX-916)

**Date**: 2026-10-01T13:52:44+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: d4869370
**Branch**: staging
**Repository**: wykonczymy

## Research Question

Add vehicles and equipment items as the fifth and sixth kinds in `/kosz` (after inwestycje,
szablony, kasy, pracownicy): trash, restore, delete forever, 30-day purge. §1–§9 are fleet;
§10 is sprzęt, which reuses every finding of §5 and lists only what differs. What does the current trash machinery require of a new
kind, what does the fleet module look like today, and what has already been decided?

## Owner decisions (2026-10-01)

Written for fleet; the owner extended all of them to sprzęt (a trashed item keeps its
`serialNumber`).

1. **No blocker — warnings only.** Any vehicle can go to the trash, „W użyciu" or „Wycofany",
   inspections or not; the dialogs warn instead of refusing. „Losing a car's history is not really
   that big of a deal." This **departs from the umbrella rule** „trash = never-used entries only"
   (`2026-09-29-kosz-pozostalych-encji/change.md:21-22`) for fleet — every vehicle has inspections
   (below), so an „unused" gate would trash nothing. It supersedes an earlier same-day ruling
   („W użyciu" refuses the trash).
2. **`registration` stays unique.** A trashed vehicle keeps its plate; re-entering the same plate
   is refused while the trashed row exists.
3. **Gone after 30 days or on „Usuń na zawsze"** (typed name, like every kind). Either way the
   inspections and their attachment links go with it.

## Summary

- The shared machinery is ready; a new kind is mostly mechanical
  (`2026-10-01-kosz-pracownikow/research.md:33-36, 99-115`). It plugs into: the `TrashKindT` union,
  a `TRASH_KINDS` entry, a fetcher + `shapeTrashRows` argument + `getTrashContents` fetch, a purge
  `runStep` + route-test case, trash/delete tag sets, a row button, and the typed-name delete.
- **Fleet is simpler than kasy/pracownicy.** Nothing outside the fleet module references a vehicle
  id, so there is no name-map split, no entity tag, no `fetchReferenceData` change. One read
  chokepoint (`loadFleetDataset`) covers listing, count, detail 404, inspection picker and the
  reminder digest; the unread badge SQL is the only second reader.
- **An `ACTIVE` car can be trashed, so the reminder paths need the filter too.** The digest is
  covered by the chokepoint (it reads `loadFleetDataset`); the unread badge is raw SQL and must get
  its own `AND v.trashed_at IS NULL` — otherwise a trashed car's deadlines keep lighting the
  „Flota" badge. Trashing does not touch `status`, so a restore returns the car exactly as it was.
- **No write path checks status or trash today.** The three fleet actions (`updateVehicleAction`,
  `createInspectionAction`, `setVehicleFlagsAction`) would accept a trashed vehicle as written.
- **A vehicle has no name field.** The typed-name „Usuń na zawsze" needs a string; `registration`
  (`useAsTitle`, unique) is the natural one.
- **Delete forever orphans attachment files.** The DB cascade drops `vehicle_inspections_rels`
  below Payload; `media` rows and Blob bytes stay until `kosz-plikow` phase 2. Same accepted cost
  as the investment trash.
- **Correction to the umbrella:** `change.md:28-30` (2026-09-30) says fleet is „not in real use on
  prod yet". It is: the owner's sheet was imported 2026-08-26 (9 vehicles / 25 inspections) and the
  owner confirmed the reminder mail on 2026-09-15 (`manual-checks.md:183`). Priority was the only
  thing that statement drove.

## Detailed Findings

### 1. Data — local copy of the prod dump

All 9 vehicles have inspections (1–4 each, 25 total). Every vehicle and inspection row was created
in one bulk import, `2026-08-26 09:08` UTC (the owner's xlsm, `fleet-sheet-parity/change.md:58-68`).
Vehicle 8 (`WF 7029W`) is the only `RETIRED` one. `vehicle_inspections_rels` is empty — no
attachments yet. Under decision 1 every row is trashable; each one would show the inspection
warning.

### 2. Schema and FKs

- `src/collections/vehicles.ts`: `registration` text, required, `unique: true` (:28-35); `status`
  `ACTIVE`/`RETIRED`, default `ACTIVE` (:82-92; labels „W użyciu" / „Wycofany" in
  `src/lib/fleet/vehicle-status.ts:5-8`); hidden JSON `flags` (:58-64), `exemptions` (:75-81).
  Hooks: `afterChange` revalidate `vehicles` (:18), `afterDelete` revalidate `vehicles` +
  `vehicleInspections` (:19). **No `beforeChange`, no `beforeDelete`.** Access: read/create/update
  A/O/M, delete A/O (:21-26).
- `src/collections/vehicle-inspections.ts`: `vehicle` relationship, required (:31-37);
  `attachments` upload → media, `hasMany` (:110-116); notification bookkeeping (:117-134), reset by
  a `beforeChange` (:20).
- Migration `src/migrations/20260818_1_add_fleet.ts`: unique index `vehicles_registration_idx`
  (:41); `vehicle_inspections.vehicle_id NOT NULL … ON DELETE cascade` (:47);
  `vehicle_inspections_rels` cascades from both parent and media (:75-81); lock rels cascade
  (:93-103).
- **Nothing else references a vehicle or inspection** — checked transactions, equipment, media,
  notifications, investments, users. `notification_recipients_fleet_digest` holds emails only.

### 3. Read paths

| Reader                                                                            | Where                                                                            | Kind                                  | Cache                                                      | Trash handling needed                                                                                                                                  |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `loadFleetDataset`                                                                | `src/lib/fleet/dataset.ts:27-61`                                                 | Payload `find`, no `where`            | via callers                                                | **add `trashedAt: { exists: false }` (or equals null) on vehicles** — `groupByVehicle` (:67-77) then drops the trashed car's inspections automatically |
| `getFleetDataset`                                                                 | `src/lib/queries/fleet.ts:19-33`                                                 | wraps the above                       | `fleet-dataset-v4`, tags `vehicles` + `vehicleInspections` | bump the key if the dataset shape changes                                                                                                              |
| `fetchFleetOverview` → `/flota` list, „w użyciu" count, listing inspection picker | `queries/fleet.ts:41-51`, `flota/page.tsx:23,26`, `fleet-data-table.tsx:49`      |                                       | cached                                                     | covered by the chokepoint                                                                                                                              |
| `fetchVehicleDetail` → `/flota/[id]`                                              | `queries/fleet.ts:54-68`, `flota/[id]/page.tsx:33`                               | `.find` on cached list → `notFound()` | cached                                                     | covered (404)                                                                                                                                          |
| Reminder digest                                                                   | `src/lib/fleet/sweep-io.ts:7-8` → `reminder-sweep.ts:71` skips non-`ACTIVE`      | uncached                              |                                                            | covered by the chokepoint (an `ACTIVE` car can be trashed)                                                                                             |
| Unread badge                                                                      | `src/lib/db/notifications.ts:74-79`, `JOIN vehicles v … AND v.status = 'ACTIVE'` | raw SQL, every shell render           | none                                                       | **add `AND v.trashed_at IS NULL`** — the status filter no longer excludes a trashed car                                                                |
| `setVehicleFlagsAction` read                                                      | `src/lib/actions/fleet.ts:83-89`                                                 | `findByID`                            |                                                            | write gate below                                                                                                                                       |

No dashboard tile, search or other counter reads vehicles.

### 4. Write paths (all `protectedAction` → `MANAGEMENT_ROLES`, none checks status)

- `createVehicleAction` `fleet.ts:24-37`
- `updateVehicleAction` `:39-52` (status lives here, via `EditVehicleDialog`)
- `createInspectionAction` `:54-70`
- `setVehicleFlagsAction` `:76-114`
- cron `stampNotified` → `stampSequentially` (`sweep-io.ts:14-32`) — only for digest vehicles,
  which come from the filtered dataset, so never a trashed one.

No inspection update/delete, no vehicle delete. Duplicate plate surfaces through the generic
`toActionFailure` (`run-action.ts:62-65`); the form uppercases/trims the plate
(`vehicle-form.tsx:52`).

### 5. Trash machinery a new kind plugs into (current tree)

1. **Column** — copy `src/collections/cash-registers.ts:80-88` (`trashedAt` date, create/update
   access `() => false`, `admin.hidden`). Hand-written additive migration, shape of
   `src/migrations/20260930_3_cash_register_trashed_at.ts` / `20261001_1_users_trashed_at.ts`;
   register in `src/migrations/index.ts`. Additive → prod migrate before push.
2. **Types / registry** — `TrashKindT` in `src/types/trash.ts:1`; `TrashRowT` (:3-16) needs
   `autoPurges`, `hasSheet: false`, `pairedRegisters: []`. `TRASH_KINDS` entry in
   `src/components/trash/trash-kinds.ts:27-70` (fields `sectionTitle`, `restore`, `restored`,
   `deleteForever(id, confirmName)`, `lost?`, `note?`, `nameLabel`, `deleted`, `failed`);
   **declaration order = /kosz section order** (:26).
3. **Query** — `src/lib/queries/trash.ts`: a fetcher, a `shapeTrashRows` positional argument
   (:23-71) and a `getTrashContents` fetch (:74-90, uncached, `requireAuth(MANAGEMENT_ROLES)`).
4. **SQL** — new `src/lib/db/vehicle-trash.ts`: list trashed (`trashed_at IS NOT NULL ORDER BY
trashed_at DESC`) and `selectPurgeable…Ids(db, days)` — twins at
   `src/lib/db/cash-register-trash.ts:19-46`.
5. **Purge** — `src/lib/<kind>/purge-trash.ts` over the shared `purgeTrashedRows`
   (`src/lib/cron/purge-trashed-rows.ts:12-35`), `revalidateTag(…, EXPIRE_NOW)` over the delete tag
   set; retention `ENTITY_TRASH_RETENTION_DAYS` (`src/lib/constants/trash.ts:4`, add the kind to its
   comment). New `runStep` + `steps` entry + response key in
   `src/app/(payload)/api/cron/cleanup/route.ts:26-38`; route test cases per
   `src/__tests__/app/(payload)/api/cron/cleanup/route.test.ts` (mock, default, every full-response
   `toEqual`, the all-throw case, an isolation case).
6. **Actions** — `src/lib/actions/<kind>-trash.ts` mirroring `cash-register-trash.ts`: trash
   (`withPayloadTransaction`, idempotent on already-trashed, refusals decided before the first
   write — `lessons.md:2432-2437`), restore (`trashedAt: null`), delete forever (`isNameConfirmed`
   then `payload.delete` — `src/lib/cash-registers/delete-cash-register-forever.ts:15-48` minus the
   `APIError < 500` → blocked branch, since nothing refuses).
7. **No blocker** — decision 1. No `makeDeleteBlocker` predicate, no `beforeDelete` hook; the trash
   action has no refusal at all. The dialog carries the warnings instead: a
   „W użyciu" car stops sending przypomnienia, and its N przeglądów go with it at purge. The
   inspection count is the one extra read the button needs.
8. **Typed name** — `isNameConfirmed` / `NAME_MISMATCH_MESSAGE` (`src/lib/constants/trash.ts:10-13`);
   the dialog compares to `TrashRowT.name` (`src/components/trash/delete-forever-dialog.tsx:17-67`).
   Unconditional for every kind (`AGENTS.md` Auth section, commit `2e51b751`).
9. **No update guard** (owner, 2026-10-01). Once trashed, the car is gone from the listing and its
   page 404s, so the only UI route to a write is a page left open from before the trash („Edytuj
   pojazd", the flag toggles, „Dodaj przegląd"). Such a write lands harmlessly on a trashed row —
   `trashedAt` is `update: () => false`, so it cannot un-trash it, and nothing financial hangs off
   a vehicle. Unlike kasa (`guard-update.ts`), nothing to protect.
10. **Cache** — `vehicles` / `vehicleInspections` exist (`src/lib/cache/tags.ts:17-18`). Add
    `VEHICLE_TRASH_TAGS = ['vehicles']` and `VEHICLE_DELETE_TAGS = ['vehicles',
'vehicleInspections']` (hookless cascade — `lessons.md:246-252`) next to the twins at :83-105.
    No entity tags; `EntityNameT` unchanged.
11. **UI** — row button mirroring `src/components/cash-registers/trash-cash-register-button.tsx:12-42`
    (`DeleteButton` + `ConfirmDialog` „Przenieść do kosza?", `settleAction`, never pre-disabled, the
    refusal arrives as a toast). Mounted as a new `col.display({ id: 'actions' })` in
    `src/components/tables/fleet.tsx:16-102` (no actions column today), as
    `tables/cash-registers.tsx:63-72` does. `/kosz` page, empty state, nav need no change
    (`trash-contents.tsx:7-15`). `fateOf` (`trash-section.tsx:7-11`) works as is with
    `autoPurges: true`.
12. **Docs** — `AGENTS.md` /kosz paragraph if the policy text names kinds; `test-plan.md` risk #15
    (:66, :89) gains fleet; `manual-checks.md` new `## EX-915 — kosz-floty` section.

### 6. Attachments and the media probes

- `MEDIA_RELATIONS` includes `vehicle-inspections.attachments`
  (`src/lib/media/relating-collections.ts:21`), read by `findReferencedMedia`
  (`delete-unreferenced-media.ts:80-102`) and `preventReferencedMediaDelete`
  (`src/hooks/media/prevent-referenced-delete.ts:14-22`) through Payload `find` on inspections.
  `trashed_at` goes on `vehicles` only, so the probes keep seeing a trashed car's attachments —
  a shared file cannot be deleted from Blob while the car can still be restored. Correct; leave
  them alone.
- Delete forever: cascade removes inspections → `_rels`; media rows + Blob bytes orphaned, named as
  a known leak in `context/changes/2026-09-22-kosz-plikow/plan.md:20-23` (still `planned`).
  Today 0 attachments exist.

### 7. Roles

Fleet is MANAGEMENT-only (nav `sections.ts:60`, page guards `flota/page.tsx:17-18`,
`flota/[id]/page.tsx:23-24`). MANAGER parity applies (umbrella decision). The collection's
`delete: isAdminOrOwner` stays narrower than the app path, as accepted for investments and kasy
(app paths use `overrideAccess`, `kosz-inwestycji-manager/review-gate.md:14`).

### 8. Unique registration

- Precedent (szablony, `kosztorys-editor-domain-notes.md:1719-1726`): keep the key, refuse with a
  message pointing to /kosz. Freeing the key would move the collision to „Przywróć", where a 23505
  from `payload.update` reaches the toast raw.
- Today the duplicate goes through generic `toActionFailure`. Plan: a pre-check in
  `createVehicleAction` / `updateVehicleAction` that names the trashed vehicle and /kosz, or a
  mapping of the unique error. Restore can never collide while the key stays taken.

### 9. Tests to mirror / touch

- New: `<kind>-trash.db.test.ts` (action, incl. wrong name; an `ACTIVE` car with inspections
  trashes fine and drops out of the listing, the badge count and the digest), `lib/db/` trash
  spec, purge db spec, cron route cases, `queries/trash.test.ts` and
  `trash-contents.test.tsx` rows — twins listed under kasa (`src/__tests__/lib/actions/cash-register-trash.db.test.ts`
  etc.).
- Touched: `vehicle-update.test.ts`, `vehicle-flags.test.ts`, `inspection-cost.test.ts`,
  `fleet-data-table.test.tsx`, helper `src/__tests__/helpers/fleet.ts`. No direct spec exists for
  `loadFleetDataset`, `fetchVehicleDetail` or `countUnreadFleetDeadlines` — the hide must get one.
- E2E: defer to the backlog like EX-952 / EX-963.

### 10. Sprzęt (EX-916) — what differs from fleet

Same shape: nothing outside the module points at an item, delete cascades its own history
(`equipment_events.equipment_id` CASCADE, `20260903_0_add_equipment.ts:63`), collection tags only.
Local copy of prod: 1 item (`IN_USE`, null serial), 1 event naming a holder, 1 warehouse,
0 attachments.

**Schema** — `src/collections/equipment.ts`: `name` required, **not unique** (`:47`, `useAsTitle`
`:22` — three „szlifierka" is normal); `serialNumber` optional + unique (`:56-60`), nullable column
with a plain unique index (migration `:38,55`), `''` normalised to null (`:29-32`) — blank serials
never collide. Status `IN_USE | RETIRED | SOLD | LOST | STOLEN`, only `IN_USE` live
(`equipment-status.ts:1,20`). Hooks: revalidate pair (`:33-35`), no `beforeDelete`. Access delete
A/O, rest incl. MANAGER (`:37-42`).

**Read paths — five, not one chokepoint** (all need `trashed_at IS NULL`):

| Read                      | Where                                                              | Feeds                                                        | Cache                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `loadEquipmentOverview`   | `src/lib/db/equipment.ts:47`                                       | `/sprzet` listing + „gdzie jest" filter options              | `getEquipmentDataset`, key `equipment-dataset-v2`, tags equipment / equipmentEvents / warehouses (`src/lib/queries/equipment.ts:36-64`) |
| `loadEquipmentById`       | `db/equipment.ts:60`                                               | `/sprzet/[id]` → `notFound()` (`sprzet/[id]/page.tsx:32`)    | uncached                                                                                                                                |
| `loadEquipmentHistory`    | `db/equipment.ts:108`                                              | same page — unreachable once the item 404s; no filter needed | uncached                                                                                                                                |
| `loadEquipmentAtLocation` | `db/equipment.ts:87` (already live-status only, `:101`)            | worker card „Sprzęt" (`pracownicy/[id]/page.tsx:38`)         | uncached                                                                                                                                |
| `loadWarrantyRows`        | `src/lib/equipment/sweep-io.ts:13-21` (`payload.find`, `IN_USE`)   | warranty cron `api/cron/equipment-reminders`                 | uncached                                                                                                                                |
| `countUnreadWarranties`   | `src/lib/db/notifications.ts:111-132` (`FROM equipment e`, `:123`) | „Sprzęt" badge                                               | uncached                                                                                                                                |

The `CURRENT_STATE` CTE (`db/equipment.ts:18-28`) reads every event but is joined from
`equipment q`, so the filter on `q` covers it. No equipment picker elsewhere, nothing in
`fetchReferenceData`. `stampNotified` (`sweep-io.ts:43`) only writes rows the sweep returned.

**Writes** (`src/lib/actions/equipment.ts`): create (`:16`, item + first event, one transaction),
update (`:57`), transfer (`:72`). No freeze (decision) — a stale „Przekaż" from an open page adds an
event to a trashed item, harmless. **Duplicate serial has no handling today**: Payload's unique
error reaches the toast raw via `toActionFailure` (`action-failure.ts:31-35`). The pre-check to copy
is `createWarehouseAction` (`src/lib/actions/warehouses.ts:29-38`) — and it must name /kosz when the
holder of the serial is trashed.

**Holder / warehouse coupling — the one real difference.**

- A trashed item's events stay, so they keep pinning the worker and the warehouse (FKs RESTRICT,
  `:68-69`; warehouse `beforeDelete` `warehouses.ts:10-20`). Correct while the item can be restored.
- **The worker trash refuses any worker named by any equipment event, past or present**
  (`workerUseBlocker`, `src/lib/workers/delete-blocker.ts:47-51,62`, called first by
  `trash-worker.ts:20`). So trashing the item does **not** free its last holder for the trash —
  only the purge (30 days or „Usuń na zawsze") does. Leave it: loosening the worker probe to
  ignore trashed items would let a worker reach the trash whose hard delete the RESTRICT FK still
  refuses. Worth one line in the plan, no code.
- Trashed worker + trashed item can't co-occur through the app: a worker can be trashed only with
  zero events, and `validateEquipmentEvent` refuses handing an item to a trashed worker
  (`src/hooks/equipment/validate.ts:54-57`).

**Warning source** — the current location is already on the row: `EquipmentRowT.location` via
`toLocation` (`src/lib/equipment/rows.ts:38-51`: holder / warehouse / service / unknown). The
confirm can say „U pracownika X" / „W magazynie Y" and „historia przekazań (N) zniknie" without
another read.

**UI** — `src/components/tables/equipment.tsx:107-125` already has an `actions` column (Przekaż,
Edytuj): the trash button goes there. Detail page button row `sprzet/[id]/page.tsx:75-84`
(optional — fleet's detail page has none either).

**Cache** — tags `equipment`, `equipmentEvents`, `warehouses` (`tags.ts:20-22`).
`EQUIPMENT_TRASH_TAGS = ['equipment']`, `EQUIPMENT_DELETE_TAGS = ['equipment', 'equipmentEvents']`.
`INVESTMENT_DELETE_TAGS` / `WORKER_DELETE_TAGS` already bump `equipmentEvents` (`:73-80,99-105`).

**Media** — `equipment-events.attachments` is in `MEDIA_RELATIONS` (`relating-collections.ts:22`)
but no form or action sets it (only `/admin`); 0 rows locally. Same orphan-on-purge note as §6.

**Tests to touch** — `src/__tests__/lib/db/equipment.db.test.ts` (hide), `lib/actions/equipment.db.test.ts`
(duplicate serial), `lib/equipment/warranty-digest.test.ts`, `components/nav/unread-badge.test.tsx`,
`hooks/equipment/target-invariant.db.test.ts`. E2E `e2e/equipment-registry.spec.ts` exists — the
E2E for both kinds goes to the backlog.

### 11. Shared between the two kinds

One migration adds `trashed_at` to `vehicles` and `equipment`. `TrashKindT` gains `vehicle` and
`equipment`; `TRASH_KINDS` order puts them after pracownicy (Flota, then Sprzęt — nav order). Two
`runStep`s in the cleanup cron, two purge helpers over `purgeTrashedRows`. The trash button
component is two thin wrappers over the kasa button shape — a shared generic only if the plan finds
the third copy (kasa, worker, vehicle, item = four) worth extracting.

## Code References

- `src/collections/vehicles.ts:17-92` — fields, hooks, access
- `src/collections/vehicle-inspections.ts:20-134` — FK, attachments, bookkeeping
- `src/migrations/20260818_1_add_fleet.ts:41,47,75-103` — unique index, cascades
- `src/lib/fleet/dataset.ts:27-77` — read chokepoint + grouping
- `src/lib/queries/fleet.ts:19-68` — cached dataset, overview, detail
- `src/lib/db/notifications.ts:74-79` — badge SQL (status-filtered)
- `src/lib/fleet/reminder-sweep.ts:71`, `src/lib/fleet/sweep-io.ts:7-32` — digest + stamps
- `src/lib/actions/fleet.ts:24-114` — the four write actions
- `src/components/tables/fleet.tsx:16-102`, `src/components/fleet/fleet-data-table.tsx:16-57` — listing
- `src/components/trash/trash-kinds.ts:14-72`, `src/types/trash.ts:1-20`, `src/lib/queries/trash.ts:23-90` — registry + query
- `src/app/(payload)/api/cron/cleanup/route.ts:26-50`, `src/lib/cron/purge-trashed-rows.ts:12-35` — purge
- `src/lib/actions/cash-register-trash.ts`, `src/lib/cash-registers/*`, `src/hooks/cash-registers/guard-update.ts` — the reference kind
- `src/lib/cache/tags.ts:17-18,83-105` — tags and twin sets

## Architecture Insights

- **Two readers, two filters.** With no gate, `status` no longer says anything about the trash, so
  the hide surface is exactly the readers: `loadFleetDataset` (listing, detail, picker, digest) and
  the badge SQL. Miss the second and a trashed car keeps lighting the „Flota" badge.
- **No reference-data split.** The „live + trashed twin" rule (`lessons.md:2425-2430`) exists for
  lists that double as name maps; no other entity names a vehicle, so a plain filter is right here.
- **First kind with no blocker.** Kasy and pracownicy refuse on history; fleet warns. The umbrella's
  „one predicate for trash and hard delete" degenerates to none — `/admin` delete stays as it has
  been since EX-711 (unguarded, A/O only).

## Historical Context (from prior changes)

- EX-711 (`git show 732f7567~1:context/archive/2026-08-18-flota-przeglady/review-gate.md`) — the
  vehicle `beforeDelete` guard was „not taken — nie był proszony"; `RETIRED` made reachable by
  owner ruling 2026-08-24 (commit `a7cbca10`).
- `context/archive/2026-08-25-fleet-sheet-parity/change.md:58-68` — prod import 2026-08-26.
- `context/archive/2026-09-30-kosz-kas/` — reference kind; carried the shared prep originally
  planned for EX-915 (`TRASH_KINDS`, retention constant).
- `context/changes/2026-10-01-kosz-pracownikow/research.md:99-115` — steps to add a kind; plan
  Desired End State — typed name everywhere, 30-day purge except „real work".
- `context/changes/2026-09-29-kosz-pozostalych-encji/` — umbrella; § 4 fleet, § 8 order.
- `context/changes/2026-09-22-kosz-plikow/plan.md:20-23,52-55` — orphaned inspection media; no
  inspection trash UI.

## Related Research

- `context/changes/2026-09-29-kosz-pozostalych-encji/research.md`
- `context/changes/2026-10-01-kosz-pracownikow/research.md`
- `context/changes/2026-09-22-kosz-plikow/research.md`

## Open Questions (plan-level — recommendations, not owner questions)

1. **Typed name** — `registration` (recommended: unique, what the owner reads on the list) vs
   „make model (registration)".
2. **Warning wording and placement** — in the „Przenieść do kosza?" confirm: a line for a
   „W użyciu" car (przypomnienia przestaną przychodzić) and one for „N przeglądów zniknie po 30
   dniach". Recommended: both in the trash confirm, the inspection count repeated in the /kosz
   row's `note` so „Usuń na zawsze" says what it takes.
3. **Badge SQL** — `AND v.trashed_at IS NULL` is **required**, not a belt (see §3).
4. **Duplicate-plate / duplicate-serial message** — pre-check on create/update naming /kosz
   (recommended, szablon + `createWarehouseAction` precedent) vs mapping Payload's unique error.
5. **Typed name for an item** — `name` is not unique, so the confirm cannot tell two „szlifierka"
   apart by name. The row is identified by id anyway; recommended: type `name`, and show the serial
   / make-model in the /kosz row so the owner sees which one.
6. **Shared trash button** — four near-copies after this change (kasa, pracownik, pojazd, sprzęt);
   decide in the plan whether to extract one.
