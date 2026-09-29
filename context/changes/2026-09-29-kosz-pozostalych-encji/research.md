---
date: 2026-09-29T12:40:00+02:00
researcher: Claude (Opus 5.5)
git_commit: 4c3ee036
branch: catalogue-filters-and-usage
repository: wykonczymy
topic: 'Extending the /kosz trash beyond investments — hard-deleted kosztorys records, fleet, equipment, workers, cash registers'
tags:
  [
    research,
    codebase,
    trash,
    kosz,
    soft-delete,
    users,
    cash-registers,
    vehicles,
    equipment,
    presets,
    sheets,
  ]
status: complete
last_updated: 2026-09-29
last_updated_by: Claude (Opus 5.5)
---

# Research: extending the trash beyond investments

**Date**: 2026-09-29T12:40:00+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: 4c3ee036
**Branch**: catalogue-filters-and-usage
**Repository**: wykonczymy

## Research Question

1. How does the investment trash work today, and which other entities are hard-deleted straight away
   from the app and should go through the trash instead? (The owner said "customers"; no entity by
   that name exists — see § 2.)
2. Flota and Sprzęt have no trash (in fact no delete at all).
3. Deleting an **unused** pracownik or kasa — every reference, what "unused" means, and every
   implication (auth, pickers, cache, sheets, audit trail).

Expected to split into one change (or at least one phase) per entity kind — § 8.

## Summary

- The investment trash is a hand-rolled nullable `trashed_at` column (deliberately **not** Payload's
  `trash: true` / `deletedAt`, which fails reads closed), three actions (trash / restore / delete
  forever), a 30-day purge step in `/api/cron/cleanup`, and a `/kosz` page with one section. It was
  cheap for investments because nearly every surface already read `fetchReferenceData`, which got the
  one `trashed_at IS NULL` filter. **No other entity gets that chokepoint for free** except workers and
  registers, and for those two the chokepoint is also what names them on historical rows (§ 6.4).
- **Hard-deleted straight from the app today, nothing restores them:** szablony kosztorysów
  (`deletePresetAction`), Kosztorysy v1 records (`deleteSheetAction`), Katalog prac items. Szablony
  are the cheapest to move — they have been `investments` rows with status `szablon` since
  2026-09-29, so they already carry `trashed_at`; the trash refuses them on purpose today.
- **Flota / Sprzęt have no delete in the app at all** — only `/admin`, where a delete cascades the
  whole inspection history / event log with no guard. They have lifecycle statuses
  (`RETIRED` / `SOLD` / `LOST` / `STOLEN`) that grey rows out but hide nothing.
- **Pracownicy / Kasy are half-built already:** both collections have a `beforeDelete` "in use"
  probe and an `active` toggle in the app; neither has an in-app delete. The worker side has the
  largest blast radius by far — the app's JWT auth never hits the DB, so a trashed (or even
  hard-deleted) user keeps working for up to 7 days, and nothing blocks login on `active=false` today.

## Detailed Findings

### 1. The reference implementation — investment trash

**Storage.** `trashedAt` field, `admin.hidden` (`src/collections/investments.ts:159-166`); migration
`src/migrations/20260928_0_investment_trashed_at.ts:11-21` — additive, nullable, no index (small
table). Why not Payload `trash: true` (`context/foundation/lessons.md:2216-2231`): `findByID` on a
trashed row throws (≈10 actions + a 500 on the share page), media reference probes stop seeing the
row's `assets` (a detach elsewhere could delete a shared photo from Blob), trashing becomes an
`update` so `beforeDelete` guards never run. Rule recorded there: pick the mechanism whose forgotten
filter fails **open**.

**Actions** — `src/lib/actions/investment-trash.ts`, all inside `protectedAction`
(`MANAGEMENT_ROLES`, manager parity since 2026-09-29):

- `trashInvestmentAction` (:26-72) — in `withPayloadTransaction`, refuses a szablon (:45-50),
  idempotent on already-trashed (:51), refuses on **exactly** what a hard delete refuses on via
  `investmentDeleteBlocker` (:52-56 → `src/lib/investments/delete-blocker.ts:6-16`, built from the
  generic `makeDeleteBlocker` / `excludingCancelled` in `src/lib/db/delete-blocker.ts:17,43`).
  Known accepted race (:30-32).
- `restoreInvestmentAction` (:74-90) — `trashedAt: null`.
- `deleteInvestmentForeverAction` (:96-124) — must be trashed; typed-name check server-side when the
  kosztorys is used; then `deleteTrashedInvestment`
  (`src/lib/investments/delete-investment-forever.ts:18-48`) which goes through `payload.delete` so the
  `beforeDelete: refuseDeleteWhen(...)` hook (`src/hooks/prevent-delete.ts:5-12`) re-counts.

**Cache.** `INVESTMENT_TRASH_TAGS` / `INVESTMENT_DELETE_TAGS` (`src/lib/cache/tags.ts:64-77`) — the
delete list names every **hookless cascade target** (lessons: Payload's `afterDelete` only fires for
the row it deleted). Entity tag via `investmentEntityOpts(id)`; `EntityNameT` is the closed union
`'investment' | 'cash-register'` (`tags.ts:31`).

**Purge.** `vercel.json` → `/api/cron/cleanup` daily 03:00
(`src/app/(payload)/api/cron/cleanup/route.ts:16-44`, `runStep` isolates each step).
`purgeTrash` (`src/lib/investments/purge-trash.ts:20-50`) selects in SQL
(`src/lib/db/investment-trash.ts:51-65`), deletes **serially**, counts
purged/skippedKosztorys/blocked/failed, then `revalidateTag(…, EXPIRE_NOW)` (Route Handler context).
`KOSZTORYS_USED` (`src/lib/db/investment-trash.ts:10-20`) keeps a used kosztorys out of the purge —
one fragment serves both the `/kosz` label and the purge. Retention constant
`TRASH_RETENTION_DAYS = 30` lives in `src/lib/constants/investment-lock.ts:11`. Blob files are left
as orphans for `kosz-plikow`.

**Hiding.** Chokepoint `fetchReferenceData` (`src/lib/queries/reference-data.ts:66-75`,
`WHERE status <> 'szablon' AND trashed_at IS NULL`) → listing, pickers, dashboard, crumb, detail and
kosztorys pages 404. Plus six investment-specific re-filters: `requireInvestmentOr404`
(`src/lib/queries/investments.ts:51`), the `/k/` and `/p/` token readers
(`preview-kosztorys.ts:125`, `worker-kosztorys.ts:140`), nightly snapshots (`db/snapshots.ts:78-85`),
catalogue usage (`db/catalogue-usage.ts:16`), and the write gate `lockMessageOf`
(`src/lib/db/investment-gate.ts:29-35`) that every kosztorys write, the transfer `validate` hook and
the sheet actions go through. Sums keyed by `investment_id` stay unfiltered on purpose — a live
transaction blocks the trash, so totals can't be affected.

**UI.** `src/app/(frontend)/kosz/page.tsx:7-15` renders one `<TrashedInvestmentsList>`; query
`src/lib/queries/trash.ts:18-33` (uncached, auth-checked); components under `src/components/trash/`
(`trashed-investments-list.tsx`, `trashed-investment-actions.tsx`, `delete-forever-dialog.tsx`);
entry point `src/components/investments/trash-investment-button.tsx` mounted in
`src/components/tables/investments.tsx:309`; nav `src/lib/constants/sections.ts:34,59`.

**Tests.** `src/__tests__/lib/actions/investment-trash.db.test.ts`,
`src/__tests__/lib/db/investment-trash.db.test.ts`,
`src/__tests__/lib/investments/purge-trash.db.test.ts`,
`src/__tests__/app/(payload)/api/cron/cleanup/route.test.ts`,
`src/__tests__/components/trash/delete-forever-dialog.test.tsx`, plus the hide-site specs. **Gaps:**
no spec asserts `fetchReferenceData` excludes trashed rows; `context/foundation/test-plan.md` has no
trash risk row; E2E backlog is EX-874.

### 2. What is hard-deleted from the app today ("customers")

No `customers` collection exists. Every in-app delete path:

| Entity                                                     | UI                 | Delete in app                                                                                                                                                       | Hard/soft                                          | Cascade                                    | Who   |
| ---------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------ | ----- |
| Inwestycje                                                 | /inwestycje        | trash → `/kosz`                                                                                                                                                     | soft                                               | kosztorys tree, versions, share links      | A/O/M |
| **Szablony kosztorysów** (`investments`, status `szablon`) | /szablony          | `deletePresetAction` (`src/lib/actions/kosztorys-presets.ts:140-160`), button `components/presets/preset-row-actions.tsx:47`, dialog "zniknie bezpowrotnie"         | **hard**                                           | whole tree + all versions                  | A/O   |
| **Kosztorysy v1** (`kosztoryses`)                          | /kosztorysy        | `deleteSheetAction` (`src/lib/actions/sheets.ts:272-294`), button `components/sheets/linked-sheet-actions.tsx:70` "Usuń kosztorys", "Tej operacji nie można cofnąć" | **hard** (Google Sheet stays on Drive)             | unlinks its investment                     | A/O   |
| **Katalog prac** (`work-catalogue-items`)                  | /katalog-prac      | `src/lib/actions/work-catalogue.ts:85-90`, `components/work-catalogue/catalogue-row-actions.tsx:32`                                                                 | **hard**                                           | nothing (kosztorysy keep their own copies) | A/O/M |
| Kosztorys sections/items/stages                            | editor             | `src/lib/actions/kosztorys.ts`                                                                                                                                      | hard, but snapshot first → undoable via Wersje     | children                                   | A/O/M |
| Share links (investor / worker)                            | editor dialogs     | revoke                                                                                                                                                              | hard (token; re-share mints a new one)             | —                                          | A/O/M |
| Media                                                      | galleries          | detach → `deleteUnreferencedMedia`                                                                                                                                  | hard incl. Blob; own trash planned (`kosz-plikow`) | —                                          | A/O   |
| Zgłoszenia (`leads`)                                       | /zgloszenia        | **none** (only `/admin`)                                                                                                                                            | —                                                  | `leads_rels`                               | A/O   |
| Transakcje                                                 | /                  | cancel only                                                                                                                                                         | soft (`cancelled` + reversal row)                  | —                                          | —     |
| Pracownicy / Kasy                                          | /pracownicy, /kasy | deactivate only                                                                                                                                                     | soft (`active`)                                    | —                                          | —     |
| Flota / Sprzęt / Magazyny                                  | /flota, /sprzet    | **none**                                                                                                                                                            | —                                                  | —                                          | —     |

Ranked candidates for "customers": **Kosztorysy v1** (literal "Usuń kosztorys" + "cannot be
undone"; "customers" is a plausible voice-to-text of "kosztorysy"), **Szablony** (hard, explicitly
refused by the trash), Zgłoszenia (the natural meaning of "customers", but no delete exists at all).
**Unresolved — owner to confirm** (Open Questions #1).

### 3. Szablony kosztorysów — the cheapest addition

Szablony are `investments` rows (status `szablon`) since 2026-09-29, so the column, the delete
blocker, the purge machinery and the delete-forever path all exist. What changes:

- `trashInvestmentAction` refusal at `investment-trash.ts:45-50` and `deletePresetAction` becomes a
  trash; the template list (`components/tables/presets.tsx`) and the template pickers must filter
  `trashed_at IS NULL` — `fetchReferenceData` excludes szablony entirely, so the template readers are
  a **separate** set of read sites (grep `TEMPLATE_INVESTMENT_STATUS` / `isTemplateInvestment`).
- `/kosz` needs a „Szablony" section (or szablony shown in the investments section with a marker).
- `KOSZTORYS_USED` means nothing for a szablon (items are template content, quantities 0), so the
  purge rule needs its own answer: purge after 30 days, or never.
- **Reverses a recorded decision:** "Never a template" (`context/archive/2026-09-24-kosz-inwestycji/change.md`),
  also in `context/reference/kosztorys-editor-domain-notes.md:1620-1622`. Needs the owner's explicit yes.
- Unique `name` on szablony: a trashed szablon keeps its name, so re-creating one with the same name
  collides — decide whether the error points to `/kosz`.

**Kosztorysy v1** — the delete removes only the bookkeeping row (the Google Sheet stays on Drive), and
re-linking is possible by re-adding the sheet. A trash here protects little; the real cost of today's
delete is the silent unlink of the investment. Worth asking whether "trash" or "confirm better" is the
actual need.

### 4. Flota (vehicles) and Sprzęt (equipment)

**No delete in the app.** `vehicles` / `equipment` `access.delete = isAdminOrOwner`
(`src/collections/vehicles.ts:25`, `equipment.ts:41`), no `beforeDelete`; `src/lib/actions/fleet.ts`
and `src/lib/actions/equipment.ts` have no delete action. `warehouses` already has a `beforeDelete`
that refuses while any event points at it (`warehouses.ts:10-20`).

**FK graph** (migrations `20260818_1_add_fleet.ts`, `20260903_0_add_equipment.ts`):

| child → parent                                         | ON DELETE                |
| ------------------------------------------------------ | ------------------------ |
| `vehicle_inspections.vehicle_id` (NOT NULL) → vehicles | CASCADE                  |
| `vehicle_inspections_rels.*` → inspections / media     | CASCADE                  |
| `equipment_events.equipment_id` (NOT NULL) → equipment | CASCADE                  |
| `equipment_events.holder_id` → users                   | RESTRICT (+ users probe) |
| `equipment_events.warehouse_id` → warehouses           | RESTRICT (+ hook)        |
| `equipment_events.investment_id` → investments         | SET NULL                 |
| `equipment_events.created_by_id` → users               | SET NULL                 |
| `equipment_events_rels.*` → events / media             | CASCADE                  |

Nothing outside points **at** a vehicle or an equipment item — no transfers (fleet "Koszty" is the sum
of inspection `cost`, `src/lib/fleet/costs.ts`), no investments. So nothing needs protecting on the
outside; the loss is the entity's **own** history: inspections (odometer, insurer, policy, costs,
attachments) for a vehicle; the append-only „kto miał ostatni" chain for equipment.

**Existing lifecycle statuses** — vehicles `ACTIVE`/`RETIRED` (`src/lib/fleet/vehicle-status.ts:1`),
equipment `IN_USE`/`RETIRED`/`SOLD`/`LOST`/`STOLEN` (`src/lib/equipment/equipment-status.ts:1,20`).
They grey out rows and drop them from reminder crons and badges; they **never hide** a row. The
equipment catalogue decided "lifecycle is its own field" — end-of-life keeps the log
(`context/archive/2026-09-01-katalog-sprzetu/change.md:34-37`). So the trash here is for mistaken /
duplicate / test entries, not end of life.

**Read sites to filter:**

- **Fleet — one chokepoint.** `loadFleetDataset` (`src/lib/fleet/dataset.ts:29-35`) feeds the
  listing, count, inspection-dialog vehicle picker, `fetchVehicleDetail`
  (`src/lib/queries/fleet.ts:54` → `/flota/[id]` 404s) and the reminder digest
  (`src/lib/fleet/sweep-io.ts:7`); `groupByVehicle` drops a trashed car's inspections automatically.
  Separately: the badge SQL (`src/lib/db/notifications.ts:77`).
- **Equipment — scattered raw SQL.** `loadEquipmentOverview` / `loadEquipmentById` /
  `loadEquipmentAtLocation` / `loadEquipmentHistory` (`src/lib/db/equipment.ts:46,59,91,114`), the
  warranty cron (`src/lib/equipment/sweep-io.ts:14-16`), the badge (`notifications.ts:123-124`).
- **Write gates:** `updateVehicleAction`, `createInspectionAction`, `setVehicleFlagsAction`
  (`fleet.ts:39,54,76`); `updateEquipmentAction`, `transferEquipmentAction` (`equipment.ts:57,72`).
- **Leave alone:** the users/warehouse delete probes — a trashed item's events must keep pinning the
  holder/warehouse while it can still be restored.

**Cache:** collection tags only (`vehicles`, `vehicleInspections`, `equipment`, `equipmentEvents` —
`tags.ts:17-22`); no entity tags exist or are needed. Trash/restore: the parent tag; delete forever:
parent + child tag.

**Files:** a hard delete cascades `_rels` below Payload and orphans `media` rows + Blob bytes — the
same accepted cost as the investment trash, reclaimed once `kosz-plikow` ships.

**Unique keys:** `vehicles.registration` and `equipment.serialNumber` are unique — a trashed row
keeps its value and blocks re-entering a corrected record.

Prod dump 2026-09-29: 9 vehicles / 25 inspections; 1 equipment item / 1 event / 1 warehouse.

### 5. Kasy (cash registers)

**Already present:** `beforeDelete` probe on live source/target transactions
(`src/collections/cash-registers.ts:16-29`); `active` toggle (`src/lib/actions/toggle-active.ts:52`,
`components/cash-registers/cash-registers-table.tsx:43`). No in-app delete.

**References to `cash_registers.id`:** `transactions.source_register_id` / `target_register_id`
(SET NULL — blocked while live), `users.default_cash_register_id` (SET NULL, non-blocking — clear it on
trash), `payload_locked_documents_rels` (CASCADE, harmless). Not in Google Sheets. Balances are
computed on read from live transactions (`src/lib/db/sum-transfers.ts:63-104`), so an unused kasa's
balance is 0 and no total moves.

**"Unused":**

```sql
NOT EXISTS (SELECT 1 FROM transactions t
            WHERE (t.source_register_id = r OR t.target_register_id = r)
              AND t.cancelled IS NOT TRUE)
```

That is the current probe; commit `7728e424` (2026-08-28) exempted cancelled rows deliberately. Cost:
delete forever blanks the kasa on cancelled rows in the audit view (`?cancelledTransactionAudit=1`).
Local copy: registers 6, 31, 42 unused; 30 has only one cancelled row.

**Read sites:** `/kasy` (`src/lib/queries/cash-registers.ts:33`), `kasa/[id]/page.tsx:48` (404),
manager dashboard, **employee dashboard redirect** to their WORKER kasa
(`(dashboard)/page.tsx:18` — hidden kasa ⇒ `notFound()`), transfer pickers (`expense-form.tsx:320,335`,
`deposit-form.tsx:251`, `internal-transfer-form.tsx:83,94`, `source-register-field.tsx:35`,
`cash-register-field.tsx`), default-kasa pickers (`worker-form.tsx:93`, `add-worker-dialog.tsx:45`,
`edit-worker-dialog.tsx:44`), `/pracownicy` register map, filters (`build-filter-config.ts:22`),
default preselect (`utils/default-cash-register.ts:7`).

**Write gate:** `validateSourceRegister` (`src/lib/actions/validate-source-register.ts:22`) checks
neither `active` nor trash; the transfer `validate` hook must refuse a trashed `targetRegister` too.

### 6. Pracownicy (users)

#### 6.1 Already present

`beforeDelete` probe (`src/collections/users.ts:22-69`) blocks on live transactions where the user
is `worker` / `createdBy` / `updatedBy`, `amount-edits.editedBy`, `cash-registers.owner`,
`kosztorys-stages.worker`, `equipment-events.holder`; message ends „Zamiast usuwać, odznacz Aktywny".
Plain authorship (media uploader, snapshot `takenBy`) is deliberately **not** a blocker
(users.ts:15-21). `active` toggle (`toggle-active.ts:43`). `/pracownicy` lists **every role**
(`pracownicy/page.tsx:19`), not only EMPLOYEE.

#### 6.2 References to `users.id`

| table.column                                                                                                | null         | ON DELETE                                          | probe                                                                                |
| ----------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `transactions.worker_id` (wypłata recipient)                                                                | yes          | SET NULL                                           | blocks (live)                                                                        |
| `transactions.created_by_id` / `updated_by_id`                                                              | yes          | SET NULL                                           | blocks (live) — CANCELLATION rows are live, so whoever cancelled anything is blocked |
| `amount_edits.edited_by_id`                                                                                 | yes          | SET NULL                                           | blocks                                                                               |
| `cash_registers.owner_id`                                                                                   | **NOT NULL** | SET NULL (declared) ⇒ effectively RESTRICT (23502) | blocks                                                                               |
| `kosztorys_stages.worker_id`                                                                                | yes          | SET NULL                                           | blocks (incl. trashed investments)                                                   |
| `equipment_events.holder_id`                                                                                | yes          | RESTRICT                                           | blocks (any event, past too)                                                         |
| `equipment_events.created_by_id`, `media.created_by_id`, `kosztorys_snapshots.taken_by`                     | yes          | SET NULL                                           | no (deliberate)                                                                      |
| `kosztorys_worker_shares.worker_id`                                                                         | NOT NULL     | CASCADE                                            | no                                                                                   |
| `notification_reads.user_id`, `users_sessions`, `payload_preferences_rels`, `payload_locked_documents_rels` | —            | CASCADE                                            | no, harmless                                                                         |

Non-FK: snapshot JSON stores etap `worker_id` — `liveWorkerIds`
(`src/lib/kosztorys/insert-kosztorys-tree.ts:23-43`) drops ids that no longer exist but would
**re-attach a trashed-but-existing** worker on restore. Google Sheet stores only the name as text on
PAYOUT rows (`src/lib/google/tab-rows.ts:107`) — nothing dangles. `notification-recipients` global is
free-text emails — a trashed person keeps receiving mail.

#### 6.3 "Unused"

```sql
NOT EXISTS live transactions with worker/created_by/updated_by = u
AND NOT EXISTS amount_edits.edited_by = u
AND NOT EXISTS kosztorys_stages.worker = u
AND NOT EXISTS equipment_events.holder = u
AND NOT EXISTS cash_registers owned by u that are themselves used
-- owned kasy that ARE unused go to the trash together with the worker (owner_id NOT NULL)
-- policy: u <> current user; u is not the last OWNER/ADMIN
```

The probe exists; the new part is the **owned-kasa pair**. Local copy: 20, 23, 26, 29, 61 (inactive)
and 37 unused; 46 owns only empty kasa 31. Trap: 42, 44, 64 have no transactions of their own but
others booked on their kasa; 35's kasa 13 has 41 live transactions — all blocked by the kasa, not by
themselves.

#### 6.4 The hard parts

- **Auth — the largest gap.** `getCurrentUserJwt` (`src/lib/auth/get-current-user-jwt.ts:23-29`)
  decodes the cookie with no DB round-trip; its own comment: "a deleted/disabled user stays valid
  until token expires (7 days)". `requireAuth` / `protectedAction` rely on it. No `beforeLogin` hook,
  and `loginAction` (`src/lib/actions/auth.ts:14`) never checks `active` — **deactivated users can log
  in today.** A trash needs: a `beforeLogin` refusal, deleting the user's `users_sessions` rows, and
  either a DB check on the JWT path or an accepted 7-day window. Fixing it for the trash naturally
  fixes `active=false` too.
- **Names on history.** `fetchReferenceData` (`reference-data.ts:53-80`) is the pickers' chokepoint
  **and** the source of the name maps for transaction rows (`transfer-mapping.ts:32,34`). Filtering
  trashed workers/kasy in its SQL would blank names on the cancelled rows they still own. Needs a
  `trashed` flag filtered per consumer, or a separate names-only map.
- **`/p/` worker link** (`src/lib/queries/worker-kosztorys.ts:53`) has no `active` or trash check;
  domain notes say revocation is deliberate only (EX-888, `kosztorys-editor-domain-notes.md:386`).
- **No guard** against self-delete or deleting the last OWNER/ADMIN anywhere.
- **Role asymmetry:** `toggle-active.ts` runs under `MANAGEMENT_ROLES` with `overrideAccess: true`,
  so a MANAGER can already deactivate an OWNER; `access.delete` is A/O; the investment trash gave
  MANAGER full parity.

**Worker read sites:** listing / detail (`pracownicy/page.tsx:19`, `[id]/page.tsx:41` → 404), PAYOUT
picker (`expense-form.tsx:342`), transfer filters (`build-filter-config.ts:24-25`), dashboard
(`queries/dashboard.ts:18`), register-owner names and pickers (`queries/cash-registers.ts:13`,
`kasa/[id]/page.tsx:60,65`, add/edit register dialogs), equipment holder pickers (7 sites under
`sprzet/` and `components/equipment/`), kosztorys stage-worker UI (`kosztorys_v2/page.tsx:104` →
`stage-worker-section.tsx`, `stage-header.tsx`, `kosztorys-workers-menu.tsx`,
`summary-panel-content.tsx:279`), `/p/` link, snapshot restore, login + JWT. Pickers today use
`activeOrSelected` (`src/lib/utils/is-active-ref.ts:11`) — a widenable hint, not an exclusion; the
trash must be a hard exclusion.

**Write gates:** transfer `validate` hook must refuse a trashed PAYOUT `worker`; stage-assignment and
equipment-transfer actions must refuse a trashed worker.

**Cache:** trash/restore → `users` / `cashRegisters`; hard delete also `transfers` (cancelled rows
lose FKs) and `equipmentEvents` (`created_by` nulled).

### 7. Cross-cutting pieces every kind will touch

- **Retention constant** lives in `investment-lock.ts:11`, an investment module; the planned
  `kosz-plikow` defines a second `TRASH_RETENTION_DAYS` (name collision). Move to a trash-owned module
  first.
- **`/kosz` page** — one `<h2>` section per kind beside `TrashedInvestmentsList`; the empty state
  „Kosz jest pusty" is page-level today and needs to become per-section or all-empty.
- **Purge** — one `runStep` per kind in `/api/cron/cleanup`, each with its own route-test case.
- **`EntityNameT`** — extend only if the kind uses entity tags (kasy do; fleet/equipment don't).
- **No generic "kind in the trash" abstraction** — recorded decision; each kind brings its own
  column, hiding, gates, cascades.

## 8. Proposed split (by cost and dependency)

| #   | Change                                                                                                     | Why this order                                                                                                      | Size              |
| --- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------- |
| 0   | Prep: move retention constant, per-section `/kosz` empty state                                             | every later change touches both                                                                                     | XS — fold into #1 |
| 1   | **Szablony → kosz** (Kosztorysy v1 dropped — owner, 2026-09-29) — implemented in `kosz-szablonow` (EX-914) | column, blocker, purge already exist; reverses one decision                                                         | S                 |
| 2   | **Flota → kosz**                                                                                           | one read chokepoint, no outside FKs                                                                                 | S                 |
| 3   | **Sprzęt → kosz**                                                                                          | no outside FKs, but ~6 raw-SQL read sites + held-item question                                                      | M                 |
| 4   | **Kasy → kosz**                                                                                            | before workers — a worker's delete depends on their kasa; probe + `active` exist; picker/name-map split is the work | M                 |
| 5   | **Pracownicy → kosz**                                                                                      | biggest: login + JWT gate, owned-kasa pair, last-owner guard, `/p/` link, ~20 read sites                            | L                 |

Katalog prac (hard delete, A/O/M) and Zgłoszenia (no delete) are not in scope unless the owner names
them.

## Code References

- `src/lib/actions/investment-trash.ts:26-124` — trash / restore / delete-forever actions
- `src/lib/investments/delete-investment-forever.ts:18-48` — delete through `payload.delete`
- `src/lib/investments/purge-trash.ts:20-50` — serial purge
- `src/lib/db/investment-trash.ts:10-65` — `KOSZTORYS_USED`, list, purge selection
- `src/lib/db/delete-blocker.ts:17,43` / `src/hooks/prevent-delete.ts` — generic blockers
- `src/lib/queries/reference-data.ts:53-80` — the read chokepoint
- `src/lib/db/investment-gate.ts:29-35` — write gate
- `src/lib/cache/tags.ts:31,64-77` — `EntityNameT`, trash/delete tag lists
- `src/app/(frontend)/kosz/page.tsx:7-15`, `src/lib/queries/trash.ts:18-33`, `src/components/trash/*`
- `src/lib/actions/kosztorys-presets.ts:140-160` — szablon hard delete
- `src/lib/actions/sheets.ts:272-294` — Kosztorysy v1 hard delete
- `src/collections/users.ts:15-69` — user delete probe
- `src/collections/cash-registers.ts:16-29` — register delete probe
- `src/lib/actions/toggle-active.ts:43-58` — `active` toggle
- `src/lib/auth/get-current-user-jwt.ts:23-29` — DB-free JWT auth
- `src/lib/fleet/dataset.ts:29-35` — fleet read chokepoint
- `src/lib/db/equipment.ts:46,59,91,114` — equipment readers
- `src/lib/db/notifications.ts:77,123-124` — fleet / warranty badges

## Architecture Insights

- **Fail open, not closed.** A soft-delete column that a forgotten filter ignores shows a stale row;
  Payload's `trash: true` that a forgotten filter hits throws. The team chose the first on purpose
  (lessons.md:2216).
- **One predicate for trash and hard delete.** Trashing refuses on exactly what the hard delete's
  `beforeDelete` refuses on, so nothing sits in the trash that can never leave it. Kasy and users
  already have that predicate as a `beforeDelete` probe — reuse it through `makeDeleteBlocker`.
- **Hookless cascades are cache-invalidation changes.** Every delete-forever action lists child tags
  (lessons.md:248-250).
- **Trash ≠ lifecycle status.** Workers/kasy have `active`, fleet/equipment have `RETIRED`/`SOLD`/…
  — those are end-of-life and keep history. The trash is "this should not exist" (mistake,
  duplicate, never used), which is why "unused" gates it.

## Historical Context (from prior changes)

- `context/archive/2026-09-24-kosz-inwestycji/change.md` — one shared `/kosz`, one section per kind,
  each in its own change, no generic abstraction; "Never a template"; 30-day purge; files stay.
- `context/archive/2026-09-29-kosz-inwestycji-manager/change.md` — MANAGER full parity on the
  investment trash; accepted risk of a manager hard-deleting a used kosztorys.
- `context/changes/2026-09-22-kosz-plikow/` (planned) — file trash, different design
  (`media_detachments`, 7-day window, mounted in galleries, not `/kosz`); `TRASH_RETENTION_DAYS` name
  collision.
- `context/archive/2026-09-01-katalog-sprzetu/change.md:34-37` — equipment lifecycle is its own field.
- Commit `7728e424` (2026-08-28) — cancelled rows exempt from the investment, kasa and worker probes.

## Related Research

- `context/changes/2026-09-22-kosz-plikow/research.md`

## Owner decisions (2026-09-29)

- **"Customers" = Szablony kosztorysów.** Kosztorysy v1 and Zgłoszenia are out of scope. Change #1
  is szablony only — it reverses "Never a template" from `kosz-inwestycji`.
- **Trash is for mistaken / never-used entries only.** `active` (workers, kasy) and the lifecycle
  statuses (`RETIRED`, `SOLD`, `LOST`, …) stay the way to retire something with history. So every kind
  gates the trash on an "unused" predicate.
- **MANAGER has full parity** with the owner on every new trash section, as on the investment trash.
  (Workers carry one residual: a MANAGER may only update EMPLOYEE rows today — `access/index.ts:45-49`
  — so whether parity reaches trashing an OWNER/ADMIN is decided in change #5.)
- **One change per kind**, in the order of § 8.

Questions 1, 2 and 4 below are answered by the above; the rest are owned by the per-kind change.

## Open Questions

1. ~~**"Customers"**~~ — resolved: Szablony. **"Customers"** — Kosztorysy v1, Szablony kosztorysów, both, or Zgłoszenia? (For Kosztorysy v1:
   trash, or just a clearer confirm, given the Google Sheet survives and re-linking is possible?)
2. **Trash vs status/active** — confirm the trash is for mistaken/unused entries only, and lifecycle
   (`active`, `RETIRED`, `SOLD`…) stays the way to retire something with history.
3. **Auto-purge after 30 days** per kind — or manual only? Szablony have no "used" notion.
4. **Roles** — MANAGER parity (like the investment trash) or A/O only (like `access.delete` today)?
5. **Unique keys** (szablon name, `registration`, `serialNumber`) — error pointing to `/kosz`, or free
   the key on trash?
6. **Equipment held by an employee** — refuse to trash an `IN_USE` item with a holder?
7. **Kasy "unused"** — keep "no live transactions" (cancelled rows lose their kasa on delete forever)
   or "no transactions ever"?
8. **Worker + their empty kasa** — trash together? Allow handing a used kasa to a new owner so the
   former owner can go?
9. **Should a CANCELLATION's `createdBy` block?** Today whoever cancelled anything is undeletable.
10. **Login gate** — `beforeLogin` + session purge + DB check on JWT, or accept the 7-day window?
    Apply to `active=false` too (currently deactivated users can log in)?
11. **Self-trash / last OWNER-ADMIN** guards.
12. **Trashed worker's `/p/` links and `notification-recipients` email** — revoke/drop automatically?
