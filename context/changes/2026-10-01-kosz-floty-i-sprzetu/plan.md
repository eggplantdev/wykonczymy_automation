# Kosz — flota (EX-915) + sprzęt (EX-916) Implementation Plan

## Overview

A vehicle or an equipment item entered by mistake can't be removed from the app today. This change
adds both as `/kosz` kinds — „Flota" and „Sprzęt", after „Pracownicy". Each can be trashed, restored,
deleted forever with the typed name, or purged after 30 days. The first two kinds with **no
blocker**: anything can go to the trash, and the confirm warns about what will be lost instead of
refusing.

## Current State Analysis

Full research: `context/changes/2026-10-01-kosz-floty-i-sprzetu/research.md`. In short:

- The `/kosz` machinery is ready: `TrashKindT`, `TRASH_KINDS`, `shapeTrashRows` / `getTrashContents`,
  `purgeTrashedRows`, one cron `runStep` per kind, typed name for every kind.
- Nothing outside either module references a vehicle or an item. So there's no name-map split, no
  entity tag and no `fetchReferenceData` change. The DB cascades their history:
  - `vehicle_inspections` ON DELETE CASCADE
  - `equipment_events` ON DELETE CASCADE
- **Fleet readers:** `loadFleetDataset` (`src/lib/fleet/dataset.ts:27`) is one chokepoint for the
  listing, the count, the detail 404, the inspection picker and the reminder digest. The second reader
  is the „Flota" badge SQL (`src/lib/db/notifications.ts:74-79`, filtered on `status = 'ACTIVE'` only).
- **Equipment readers** — five, no chokepoint:
  - `loadEquipmentOverview` (`src/lib/db/equipment.ts:47`)
  - `loadEquipmentById` (`:60`, the detail 404)
  - `loadEquipmentAtLocation` (`:87`, worker card)
  - `loadWarrantyRows` (`src/lib/equipment/sweep-io.ts:13`)
  - `countUnreadWarranties` (`notifications.ts:111-132`)
    `loadEquipmentHistory` is reachable only from the item page, which will 404.
- **Duplicate keys reach the toast raw** — `registration` and `serialNumber` are unique, and neither
  action pre-checks them.
- **Trash buttons:** kasa and pracownik each have a near-identical button
  (`DeleteButton` + `ConfirmDialog` + `settleAction` + toast). Fleet and equipment would make four.

## Desired End State

- `/flota` and `/sprzet` rows offer „Usuń" → „Przenieść do kosza?". The confirm warns:
  - „W użyciu" car: the reminders stop.
  - Car with history: its N inspections go with it.
  - Item: where it is now; its handover history goes with it.
    Nothing is refused.
- A trashed vehicle or item is gone from:
  - the listing, the count and the detail page (404)
  - the worker card
  - the reminder / warranty mails
  - the „Flota" / „Sprzęt" badges
- `/kosz` has „Flota" and „Sprzęt" sections:
  - Each row carries a second line identifying it: make/model, plus the serial for an item.
  - „Przywróć" brings the row back exactly as it was. Status is untouched.
  - „Usuń na zawsze" asks for the typed name (the registration for a car, the name for an item) and
    removes the row with its history.
  - The cron purges both after 30 days.
- Entering a registration or serial already held by another row is refused with a sentence. When
  the holder is trashed, the sentence points to `/kosz`.
- MANAGER parity throughout.

### Key Discoveries:

- `src/lib/actions/cash-register-trash.ts:45-106` — the action trio to mirror, minus the visibility
  filter. Both modules are MANAGEMENT-only, with nothing hidden from a MANAGER.
- `src/lib/cash-registers/delete-cash-register-forever.ts:15-48` — the delete-forever shape. Drop its
  `APIError < 500 → blocked` branch, since nothing refuses.
- `src/lib/cash-registers/purge-trash.ts:17-34` + `src/lib/cron/purge-trashed-rows.ts` — purge shape.
- `src/migrations/20261001_1_users_trashed_at.ts` — migration template (additive, `IF NOT EXISTS`).
- `src/collections/cash-registers.ts:80-88` — the `trashedAt` field (create/update access
  `() => false`, hidden).
- `src/lib/actions/warehouses.ts:29-38` — duplicate pre-check precedent.
- `src/components/trash/trash-section.tsx:23-34` — the row body where a `detail` line slots in.
- Readers filter Payload `find`s with `trashedAt: { exists: false }` and raw SQL with
  `trashed_at IS NULL` (`src/lib/queries/worker-kosztorys.ts:141`, `src/lib/db/worker-reports.ts:63`).

## What We're NOT Doing

- **No blocker, no `beforeDelete` guard**, and no update freeze on a trashed row. These are owner
  rulings: a stale page's write lands harmlessly, and `trashedAt` can't be written through it.
- **No loosening of the worker trash.** An item's events keep pinning the worker who held it, so
  trashing the item does not free that worker for the trash; only the purge / „Usuń na zawsze" does.
  Loosening `workerUseBlocker` would let a worker into the trash whose hard delete the RESTRICT FK
  still refuses.
- **No freeing of the unique key on trash.** Freeing it would move the collision to „Przywróć".
- **No media cleanup.** Inspection / event attachments are orphaned on delete forever, as already
  accepted for investments; `kosz-plikow` phase 2 owns it. There are 0 attachments today.
- **No trash button on the detail pages**, only on the list rows (`/flota/[id]` has no action row).
- **No cache-key bumps.** Neither cached dataset changes shape, and the trash action expires the
  tags.
- **No E2E spec here.** It is filed to the `e2e-backlog` at the review gate, as EX-952 was.

## Implementation Approach

Mirror the kasa kind in each module (`src/lib/fleet/`, `src/lib/equipment/`), stripped of every
refusal. Trash is a single `trashedAt` write, so there's no transaction and no core helper. The work
splits into four phases:

1. Column and hide.
2. Trash / restore / delete / purge.
3. Duplicate pre-checks.
4. UI, `/kosz` and docs.

**Dedup:** the four trash buttons (kasa, pracownik, pojazd, sprzęt) become one `TrashRowButton`. The
investment button keeps its own shape because of its pre-check fetch and its `alert` variant.

## Critical Implementation Details

- **The badge filters are what a missed reader looks like.** The status filter no longer excludes a
  trashed row, because an `ACTIVE` / `IN_USE` row can be trashed. Each badge SQL gets
  `AND … trashed_at IS NULL` of its own; nothing upstream covers it.
- **The equipment `CURRENT_STATE` CTE** reads every event, but it is joined from `equipment q`. So
  the filter belongs on `q`, not in the CTE.
- **Restore is a plain `trashedAt: null`.** It can never collide on the unique key, because the key
  stayed taken while the row was trashed.

## Phase 1: Column and hide

### Overview

The `trashed_at` column on both tables, and every reader skips a trashed row. After this phase a row
trashed by hand in SQL disappears everywhere.

### Changes Required:

#### 1. Migration

**File**: `src/migrations/20261001_2_vehicles_equipment_trashed_at.ts` (new), registered in
`src/migrations/index.ts`

**Intent**: Add the nullable column to `vehicles` and `equipment`.

**Contract**: `ADD COLUMN IF NOT EXISTS "trashed_at" timestamp(3) with time zone` on both; the down
migration drops both. Additive, so it goes to prod before push. Copy the header comment shape of
`20261001_1_users_trashed_at.ts`.

#### 2. Collections

**Files**: `src/collections/vehicles.ts`, `src/collections/equipment.ts`

**Intent**: A `trashedAt` field identical to the kasa one.

**Contract**: date field, `access: { create: () => false, update: () => false }`, `admin.hidden`.
Then run `pnpm generate:types`.

#### 3. Fleet readers

**Files**: `src/lib/fleet/dataset.ts`, `src/lib/db/notifications.ts`

**Intent**: The chokepoint and the badge skip a trashed car.

**Contract**:

- `loadFleetDataset`: the vehicles `find` gets `where: { trashedAt: { exists: false } }`. Its
  inspections drop out through `groupByVehicle`, which maps over vehicles. Check that no consumer
  indexes events without the vehicle list.
- `countUnreadFleetDeadlines`: the `JOIN vehicles v` condition adds `AND v.trashed_at IS NULL`.

#### 4. Equipment readers

**Files**: `src/lib/db/equipment.ts`, `src/lib/equipment/sweep-io.ts`, `src/lib/db/notifications.ts`

**Intent**: Every reader except history skips a trashed item.

**Contract**: add `q.trashed_at IS NULL` in:

- `loadEquipmentOverview`
- `loadEquipmentById`, which then returns `undefined`, so the page calls `notFound()`
- `loadEquipmentAtLocation`

Elsewhere:

- `loadWarrantyRows`: `trashedAt: { exists: false }` in its `where`.
- `countUnreadWarranties`: `AND e.trashed_at IS NULL`.

### Success Criteria:

#### Automated Verification:

- New `src/__tests__/lib/fleet/dataset.db.test.ts`: a trashed `ACTIVE` vehicle with inspections is
  absent from `loadFleetDataset` (vehicles and events). This is the reader the digest and the detail
  page share.
- New `src/__tests__/lib/db/notifications.db.test.ts`, or an extension of an existing one:
  - A trashed `ACTIVE` car's due inspection doesn't count toward the „Flota" badge.
  - A trashed `IN_USE` item's warranty doesn't count toward the „Sprzęt" badge.
- `src/__tests__/lib/db/equipment.db.test.ts`: a trashed item is absent from the overview, the
  by-id read and the at-location read.
- `src/__tests__/lib/equipment/warranty-digest.test.ts` (or a sweep-io db spec): `loadWarrantyRows`
  skips a trashed item.
- `pnpm exec tsc --noEmit` passes after `generate:types`.

#### Manual Verification:

- None. Nothing in the UI can trash a row yet.

**Implementation Note**: commit and continue when automated verification passes.

---

## Phase 2: Trash, restore, delete forever, purge

### Overview

The server side of both kinds: actions, SQL, purge, cron steps and tag sets.

### Changes Required:

#### 1. SQL

**Files**: `src/lib/db/vehicle-trash.ts`, `src/lib/db/equipment-trash.ts` (new)

**Intent**: List the trashed rows for `/kosz`, and select the purgeable ids. These are twins of
`src/lib/db/cash-register-trash.ts:19-46`.

**Contract**:

- `fetchTrashedVehicles(db) → { id, registration, make, model, trashedAt }[]`
- `fetchTrashedEquipment(db) → { id, name, make, model, serialNumber, trashedAt }[]`
- `selectPurgeableVehicleIds(db, days)` / `selectPurgeableEquipmentIds(db, days)`
- All ordered `trashed_at DESC` (lists) or `id` (purge).

#### 2. Delete forever + purge

**Files**:

- `src/lib/fleet/delete-vehicle-forever.ts`, `src/lib/fleet/purge-trash.ts` (new)
- `src/lib/equipment/delete-equipment-forever.ts`, `src/lib/equipment/purge-trash.ts` (new)

**Intent**: Remove a trashed row with its history; purge after `ENTITY_TRASH_RETENTION_DAYS`.

**Contract**:

- `deleteTrashedVehicle(payload, id, req?)` / `deleteTrashedEquipment(…)` return
  `DeleteForeverResultT`:
  - `not-trashed` for a live row
  - `payload.delete` with `overrideAccess` and `skipRevalidation`
  - `error` on any throw, with `logError`
  - no `blocked` branch
- `purgeVehicleTrash(payload, db)` / `purgeEquipmentTrash(payload, db)` go through
  `purgeTrashedRows`, then `revalidateTag(…, EXPIRE_NOW)` over the delete tag set when anything was
  purged.
- `src/lib/constants/trash.ts`: the retention comment names every kind (or says „every `/kosz`
  kind").

#### 3. Tags

**File**: `src/lib/cache/tags.ts`

**Intent**: Trash and delete sets beside the twins.

**Contract**:

- `VEHICLE_TRASH_TAGS = ['vehicles']`
- `VEHICLE_DELETE_TAGS = [...VEHICLE_TRASH_TAGS, 'vehicleInspections']`
- `EQUIPMENT_TRASH_TAGS = ['equipment']`
- `EQUIPMENT_DELETE_TAGS = [...EQUIPMENT_TRASH_TAGS, 'equipmentEvents']`

The delete sets need the child tags because the cascade fires no hook (`lessons.md:246-252`). Each
set carries a one-line why comment, as its twins do.

#### 4. Actions

**Files**: `src/lib/actions/vehicle-trash.ts`, `src/lib/actions/equipment-trash.ts` (new)

**Intent**: Three `protectedAction`s per kind, mirroring `cash-register-trash.ts`.

**Contract**:

- `trashVehicleAction(id)` / `trashEquipmentAction(id)`:
  - missing row → „Pojazd nie istnieje." / „Sprzęt nie istnieje."
  - already trashed → success, no write
  - otherwise one `payload.update({ trashedAt: now, overrideAccess, context: skipRevalidation })`
- `restore…Action(id)` sets `trashedAt: null`.
- `delete…ForeverAction(id, confirmName)` checks `isNameConfirmed` against the vehicle's
  `registration` / the item's `name`, then calls the delete-forever helper.
- Tags: the trash set for trash and restore, the delete set for delete forever.

#### 5. Cron

**File**: `src/app/(payload)/api/cron/cleanup/route.ts`

**Intent**: `vehicleTrash` and `equipmentTrash` steps after `workerTrash`, in `steps` and in the
response.

### Success Criteria:

#### Automated Verification:

- New `src/__tests__/lib/actions/vehicle-trash.db.test.ts`:
  - An `ACTIVE` car with inspections trashes, and the inspections stay.
  - Trashing again is idempotent.
  - Restore leaves the status untouched.
  - Delete forever refuses a wrong registration and refuses a live car.
  - With the right registration it removes the car and its inspections.
- New `src/__tests__/lib/actions/equipment-trash.db.test.ts`: the same for an item held by a worker,
  with its events.
- New `src/__tests__/lib/fleet/purge-trash.db.test.ts` and
  `src/__tests__/lib/equipment/purge-trash.db.test.ts`: older than 30 days → purged with history;
  younger → kept.
- `src/__tests__/app/(payload)/api/cron/cleanup/route.test.ts` adds both steps to:
  - the mock defaults
  - every full-response `toEqual`
  - the all-throw case
  - one isolation case per step

#### Manual Verification:

- None beyond Phase 4 (no UI yet).

**Implementation Note**: commit and continue when automated verification passes.

---

## Phase 3: Duplicate registration / serial

### Overview

Duplicate registrations and serials get a readable refusal instead of the raw unique-violation
toast. When the holder of the key is in the trash, the refusal points to `/kosz`.

### Changes Required:

#### 1. Pre-checks

**Files**: `src/lib/actions/fleet.ts` (`createVehicleAction`, `updateVehicleAction`),
`src/lib/actions/equipment.ts` (create, update)

**Intent**: Before the write, look for another row holding the same key, trashed or not.

**Contract**:

- `find` by the key, excluding the edited row's own id on update; skip when the serial is blank.
- If the holder is live: „Pojazd o rejestracji X już istnieje." / „Sprzęt o numerze seryjnym X już
  istnieje."
- If the holder is trashed: „Pojazd o rejestracji X jest w Koszu — przywróć go stamtąd." / „Sprzęt
  o numerze seryjnym X jest w Koszu — przywróć go stamtąd."
- The message templates live beside the actions' other constants, or in a small
  `lib/fleet/` / `lib/equipment/` messages module if neither module has one.
- Compare the registration the way the form normalises it (trimmed, uppercase).

### Success Criteria:

#### Automated Verification:

- `src/__tests__/lib/actions/vehicle-update.test.ts` (or a new `vehicle-create` db spec): a duplicate
  plate is refused with the sentence; one held by a trashed car names the Kosz; saving a car with its
  own plate passes.
- `src/__tests__/lib/actions/equipment.db.test.ts`: the same for a serial; two blank serials pass.

#### Manual Verification:

- Covered by Phase 4's manual pass.

**Implementation Note**: commit and continue when automated verification passes.

---

## Phase 4: UI, `/kosz`, docs

### Overview

The row buttons with their warnings, the two `/kosz` sections, one shared trash button, and the docs.

### Changes Required:

#### 1. Shared trash button

**File**: `src/components/trash/trash-row-button.tsx` (new). Migrate
`src/components/cash-registers/trash-cash-register-button.tsx` and
`src/components/users/trash-worker-button.tsx` onto it and delete both.

**Intent**: One „Usuń → Przenieść do kosza?" button for every kind whose confirm needs no fetch.

**Contract**: props:

- `label`, the `DeleteButton` text
- `description: string`
- `trash: () => Promise<ActionResultT>`
- `trashed: string`, the success toast
- `failed: string`, the fallback error toast

Its behaviour is unchanged from today's two buttons: `settleAction`, close, then toast; never
pre-disabled. The kasa and worker descriptions move to their table columns or a small describe
helper beside them; the worker's `describeTrash` keeps its wording.

#### 2. Row buttons with warnings

**Files**:

- `src/components/tables/fleet.tsx`: a new `col.display({ id: 'actions' })`, mirroring
  `tables/cash-registers.tsx:63-72`
- `src/components/tables/equipment.tsx`: added to the existing actions cell
- `src/types/fleet.ts` + `src/lib/fleet/rows.ts`: `FleetRowT.inspectionCount`
- the description helpers, colocated with the columns or in `src/lib/fleet/` /
  `src/lib/equipment/` if a spec reads them

**Intent**: The confirm warns and never refuses.

**Contract**:

- Vehicle description: „Przenieść „{registration}" do kosza? Możesz go przywrócić z Kosza."
  - `ACTIVE` adds „Przypomnienia o przeglądach przestaną przychodzić."
  - `inspectionCount > 0` adds „Po 30 dniach zniknie razem z historią przeglądów ({N})."
- Item description: „Przenieść „{name}" do kosza? Możesz go przywrócić z Kosza."
  - It adds the current location from `EquipmentRowT.location`: holder / warehouse / service.
  - It adds „Po 30 dniach zniknie razem z historią przekazań."

#### 3. `/kosz` sections

**Files**:

- `src/types/trash.ts`, `src/lib/queries/trash.ts`
- `src/components/trash/trash-kinds.ts`, `src/components/trash/trash-section.tsx`

**Intent**: Fifth and sixth kinds: „Flota", then „Sprzęt", in nav order.

**Contract**:

- `TrashKindT` gains `'vehicle' | 'equipment'`.
- `TrashRowT` gains `detail?: string`, rendered under the name in `TrashSection`:
  - vehicle: „{make} {model}"
  - item: „{make} {model} · nr ser. {serial}", dropping empty parts
- `shapeTrashRows` takes the five lists as one object instead of growing to five positional
  arrays. `getTrashContents` fetches the two new lists.
- Vehicle rows: `name` = registration, `autoPurges: true`, `hasSheet: false`,
  `pairedRegisters: []`.
- `TRASH_KINDS` entries:

|                | Vehicle                                | Item                           |
| -------------- | -------------------------------------- | ------------------------------ |
| `sectionTitle` | 'Flota'                                | 'Sprzęt'                       |
| `nameLabel`    | 'Rejestracja'                          | 'Nazwa sprzętu'                |
| `lost`         | 'historia przeglądów i ich załączniki' | 'historia przekazań'           |
| `restored`     | 'Pojazd przywrócony.'                  | 'Sprzęt przywrócony.'          |
| `deleted`      | 'Pojazd usunięty na zawsze.'           | 'Sprzęt usunięty na zawsze.'   |
| `failed`       | 'Nie udało się usunąć pojazdu'         | 'Nie udało się usunąć sprzętu' |

#### 4. Docs

**Files**:

- `context/foundation/test-plan.md`: risk #15 gains flota + sprzęt and the „a trashed row still
  counted by a badge" failure mode
- `context/foundation/manual-checks.md`: new `## EX-915/916 — kosz floty i sprzętu`
- `context/changes/2026-09-29-kosz-pozostalych-encji/research.md`: a one-line pointer in § 4 that
  fleet/equipment dropped the „never-used only" rule
- `AGENTS.md`: only if a sentence there lists the `/kosz` kinds or states the blocker rule. Today
  none does, so expect no change.

### Success Criteria:

#### Automated Verification:

- `src/__tests__/lib/queries/trash.test.ts`: vehicle and item rows are shaped, with `detail` built and
  empty parts dropped.
- `src/__tests__/components/trash/trash-contents.test.tsx`: the „Flota" and „Sprzęt" sections render
  after „Pracownicy", with the detail line.
- New `src/__tests__/components/trash/trash-row-button.test.tsx`: confirm → action called → success
  toast; a failed action → error toast. This replaces any kasa/worker button spec it supersedes.
- `src/__tests__/components/fleet/fleet-data-table.test.tsx`: the actions column renders.
- Description helpers: an `ACTIVE` car with 3 inspections gets both warnings; a retired car with none
  gets neither.
- `pnpm exec tsc --noEmit`, `pnpm lint`

#### Manual Verification:

- `/flota` → „Usuń" on an `ACTIVE` car with inspections → both warnings → in Kosz:
  - it's gone from `/flota`, its `/flota/[id]` is a 404, and the „Flota" badge drops it
  - `/kosz` shows „Flota" with the make/model line
- „Przywróć" → back with the same status. Trash again → „Usuń na zawsze" asks for the registration
  and removes it.
- `/sprzet` → „Usuń" on an item held by a worker → the confirm names the worker → it's gone from
  `/sprzet` and from the worker's card. Restore; delete forever by name.
- Add a car with the plate of a trashed one → the toast points to Kosz.
- As MANAGER: both sections visible, all three actions work.
- `/kasy` and `/pracownicy` „Usuń" still work: the shared button migration.

**Implementation Note**: commit when automated verification passes.

---

## Testing Strategy

### Unit Tests:

- Description helpers (warnings per status / count / location), `shapeTrashRows` detail lines.

### Integration Tests (5435 DB):

- Every reader hides a trashed row: fleet dataset, equipment overview / by id / at location, warranty
  rows, both badges.
- Trash / restore / delete forever / purge for both kinds, with the cascade.
- Duplicate pre-checks, live and trashed holder.

### Manual Testing Steps:

See Phase 4. E2E (browser → action → DB → revalidation) is filed to the `e2e-backlog` at the review
gate.

## Performance Considerations

None material: one extra predicate on readers of ≤ hundreds of rows, and one indexed lookup on create
or update.

## Migration Notes

The column is additive and nullable, so apply it to prod (`pnpm db:migrate:prod`, human) **before**
pushing. Run `git status src/migrations` before the local migrate: the tree is shared.

## Whole-tree Gate

Run once, after Phase 4: `pnpm exec tsc --noEmit`, `pnpm lint`, and the touched specs. The full
`pnpm test` / `pnpm test:integration` runs only if asked; the pre-push hook runs them anyway.

## Prerequisites

- The kosz-pracownikow files touched here (`trash-kinds.ts`, `queries/trash.ts`, `types/trash.ts`,
  the cron route, `trash-worker-button.tsx`) are committed (cc07411e). Re-read them at Phase 2/4
  start, because the tree is shared.
- The local DB is migrated from this tree.

## References

- Research: `context/changes/2026-10-01-kosz-floty-i-sprzetu/research.md`
- Owner decisions: `context/changes/2026-10-01-kosz-floty-i-sprzetu/change.md`
- Umbrella: `context/changes/2026-09-29-kosz-pozostalych-encji/research.md` § 4
- Reference kinds: `context/archive/2026-09-30-kosz-kas/`, `context/archive/2026-10-01-kosz-pracownikow/`
- Lessons: `context/foundation/lessons.md:246-252` (cascade child tags), `:2432-2437`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Column and hide

#### Automated

- [x] 1.1 Migration applies to the local DB; types regenerated — 7fa65735
- [x] 1.2 Fleet dataset skips a trashed vehicle and its inspections — 7fa65735
- [x] 1.3 „Flota" and „Sprzęt" badges skip a trashed row — 7fa65735
- [x] 1.4 Equipment overview / by id / at location skip a trashed item — 7fa65735
- [x] 1.5 Warranty rows skip a trashed item — 7fa65735

### Phase 2: Trash, restore, delete forever, purge

#### Automated

- [x] 2.1 Vehicle trash actions db spec
- [x] 2.2 Equipment trash actions db spec
- [x] 2.3 Vehicle and equipment purge db specs
- [x] 2.4 Cleanup cron route spec with both steps

### Phase 3: Duplicate registration / serial

#### Automated

- [ ] 3.1 Duplicate plate refused; trashed holder names the Kosz
- [ ] 3.2 Duplicate serial refused; trashed holder names the Kosz; blank serials pass

### Phase 4: UI, `/kosz`, docs

#### Automated

- [ ] 4.1 `shapeTrashRows` vehicle and item rows with detail
- [ ] 4.2 `/kosz` renders „Flota" and „Sprzęt"
- [ ] 4.3 Shared trash button spec; kasa and worker migrated
- [ ] 4.4 Fleet actions column and warning descriptions
- [ ] 4.5 Typecheck and lint clean
