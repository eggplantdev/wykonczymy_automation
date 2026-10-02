# Kosz zgłoszeń Implementation Plan

## Overview

Make leads removable (EX-970). On `/zgloszenia`, ADMIN, OWNER and MANAGER can bulk-move leads to the
trash („Do kosza"). A „Bez plików" filter surfaces the empty ones. `/kosz` gains a plain „Zgłoszenia"
section with Przywróć / Usuń na zawsze, and the 30-day cleanup cron purges the rest.

„Usuń na zawsze" is **not** a row delete. It wipes the lead's contents and keeps a tombstone. A hard
delete would be resurrected by the Facebook reconcile cron and emailed to sales as a recovered lead.

Removing a lead never touches its investment or that investment's files.

## Current State Analysis

- `src/collections/leads.ts` has no trash state. The collection's `delete` access is ADMIN/OWNER and
  nothing in the app calls it.
- Leads are deduped by `(source, externalId)` in `findStoredLead`
  (`src/lib/leads/store-lead.ts:22-37`).
- `leads-reconcile` re-fetches the last `PER_FORM_LIMIT = 100` leads of every Facebook form daily
  (`src/lib/leads/reconcile-sweep.ts`). A row deleted from `leads` comes back on the next sweep as
  `created: true` and goes out as a notification.
- Files are shared media rows, and promotion does not copy them. A promoted investment points at the
  same media ids as its lead (`src/lib/actions/promote-lead.ts`).
  `deleteUnreferencedMedia` (`src/lib/media/delete-unreferenced-media.ts:30`) deletes only ids that
  nothing in `MEDIA_RELATIONS` references, and investments are in that list. A file shared with an
  investment therefore survives any change on the lead side.
- Lead readers:
  - `getLeadsPage` (list + `newCount`, `src/lib/queries/leads.ts:135`) and `countUnreadLeads`
    (`src/lib/db/notifications.ts:27`) must hide trashed rows.
  - `findStoredLead` and `findReferencedMedia` must **keep** seeing them.
  - `captureLead` (`src/lib/leads/capture-lead.ts:71-72`) retries notify/auto-reply on a redelivery
    whose status is still `pending`.
  - The landing webhook (`src/app/(frontend)/api/webhooks/landing/route.ts:97`) re-downloads files
    onto an existing lead that holds none.

  Both of those last two would act on an erased tombstone.
- The trash infrastructure already exists:
  - `TRASH_KINDS` (`src/components/trash/trash-kinds.ts`);
  - `shapeTrashRows` / `getTrashContents` (`src/lib/queries/trash.ts`);
  - `isNameConfirmed` and `ENTITY_TRASH_RETENTION_DAYS` (`src/lib/constants/trash.ts`);
  - `purgeTrashedRows` (`src/lib/cron/purge-trashed-rows.ts`);
  - the cleanup route's `runStep` chain.

  The vehicle kind (EX-915) is the newest and smallest instance. Mirror it.
- `DataTable` has no row selection. The checkbox-column pattern is
  `catalogue-picker-table.tsx:30-70` (`SelectedIdsContext` + a `select` display column).

## Desired End State

- `/zgloszenia` has a checkbox column. The header checkbox selects or clears the **current page**.
  The toolbar shows „Do kosza (N)" once something is selected; it asks for confirmation, trashes, and
  clears the selection.
- A „Bez plików" toggle (`?noFiles=1`) lists only leads with no files attached. Every Facebook lead
  qualifies, since it cannot carry files.
- Trashed and erased leads are absent from the list, the „N nowych" count and the nav badge.
- `/kosz` lists „Zgłoszenia" like every other section: name, detail, days left, Przywróć, and
  Usuń na zawsze with the typed name.
- Usuń na zawsze and the purge both erase:
  - contents wiped: name, email, phone, address, scope, area, rawData, formQuestions, assets;
  - `erasedAt` set;
  - tombstone kept: source, externalId, formId, formName, submittedAt, investment.

  The row is then invisible everywhere. Its files are reclaimed only when nothing else references
  them.
- A Facebook redelivery or reconcile of an erased lead returns `created: false` and sends nothing.
  A landing redelivery attaches nothing.

### Key Discoveries:

- Hide with a hand-rolled `trashedAt` column, never Payload `trash: true`. `trash: true` filters
  `payload.find` globally, which would hide trashed leads from `findStoredLead` (resurrection) and
  from `findReferencedMedia` (a still-referenced file deleted). This is the same reason the other
  kinds hand-roll it.
- Field pattern: `vehicles.ts:93-101`. A `date` field with `access: { create: () => false, update: () => false }`
  and `admin.hidden`, written only with `overrideAccess`.
- Migration pattern: `src/migrations/20261001_2_vehicles_equipment_trashed_at.ts`. Use
  `ADD COLUMN IF NOT EXISTS … timestamp(3) with time zone`, no index, and register it in
  `src/migrations/index.ts`.
- Writes from the trash actions pass `context: { skipRevalidation: true }` and let
  `protectedAction`'s tag list expire `CACHE_TAGS.leads` once (`vehicle-trash.ts:12-13`).
- `countUnreadLeads` is raw SQL, so it needs its own `WHERE`. A Payload `where` does not reach it.
- `unread-counts.ts` is uncached, so the nav badge needs no tag. `getLeadsPage` is tagged
  `CACHE_TAGS.leads`.

## What We're NOT Doing

- **No hard delete of a lead row, ever.** That includes the purge, because of the resurrection
  above.
- No bulk actions in `/kosz` (owner: "a simple list, I will not be using this heavily").
- No trash button on single rows of `/zgloszenia`. Bulk with a one-row selection covers it.
- Selection does not persist across pages or searches; it clears whenever the page's rows change.
- No guard on `promoteLeadAction` / `attachLeadAssetsAction` against a trashed lead. Only a stale tab
  open across the trash could reach them, and a trashed lead is still a whole row.
- No change to the Payload `/admin` view of leads (unused, per project memory).
- No E2E in this change. It is deferred to an `e2e-backlog` issue at the review gate.

## Implementation Approach

1. **Columns + hiding first**, so the moment a row can be trashed, every reader already ignores it.
2. **Server mutations, purge, and the redelivery guards**, each pinned by a DB spec. Two of them are
   the reason for the whole erase-not-delete design:
   - the investment's files survive erasing its lead;
   - an erased Facebook lead is not re-created.
3. **The `/zgloszenia` UI**: selection, bulk trash, the „Bez plików" filter.
4. **The `/kosz` section, then docs.**

Only a trashed lead can be erased, so every tombstone also carries `trashed_at`. The user-facing
readers therefore test only `trashed_at IS NULL`. `erased_at` exists to keep a tombstone out of
`/kosz` and the purge, and to stop the redelivery paths.

## Critical Implementation Details

- **Erase order.** Read the lead's current asset ids, then write the wiped row
  (`assets: []`, `erasedAt`), and only then
  `deleteUnreferencedMedia(payload, oldIds)`. The reference scan must see the post-write state
  (`delete-unreferenced-media.ts:8-9`). Use the inline `deleteUnreferencedMedia` rather than
  `reclaimUnreferencedMedia`. The cron has no `after()` scope, and inline keeps the action and the
  purge on one code path.
- **Typed name.** The confirm string is `leadDisplayName(lead)` = `name || email || phone || "Zgłoszenie #<id>"`.
  One function feeds both the `/kosz` row's `name` and the action's `isNameConfirmed` check, so the
  string shown is the string checked. A Facebook lead with only a phone is common.
- **Erased rows leave `/kosz`.** `fetchTrashedLeads` selects
  `trashed_at IS NOT NULL AND erased_at IS NULL`, and the purge selector adds `erased_at IS NULL` so
  a tombstone is never re-erased every night.

## Phase 1: Columns and hiding

### Overview

Add `trashed_at` and `erased_at` to `leads`, and make every user-facing reader skip trashed rows.

### Changes Required:

#### 1. Migration

**File**: `src/migrations/20261002_0_leads_trashed_erased_at.ts` (+ `src/migrations/index.ts`)

**Intent**: Two nullable timestamp columns. Hand-written, per the AGENTS.md migration rule.

**Contract**: `leads.trashed_at` and `leads.erased_at`, both `timestamp(3) with time zone`, nullable,
no index (`leads` is hundreds of rows). `down` drops both.

#### 2. Collection fields

**File**: `src/collections/leads.ts`

**Intent**: Expose both columns to the Payload API without letting the API write them.

**Contract**: `trashedAt` and `erasedAt` are `date` fields, `admin.hidden`, with
`access: { create: () => false, update: () => false }`, per `vehicles.ts:93-101`. Then
`pnpm generate:types`.

#### 3. Readers

**Files**: `src/lib/queries/leads.ts`, `src/lib/db/notifications.ts`

**Intent**: Hide trashed rows from the list, from `newCount` and from the unread badge. Bump the
`unstable_cache` key so no pre-change entry serves trashed rows.

**Contract**:
- `getLeadsPage`: both the `find` and the `count` AND-in `{ trashedAt: { exists: false } }`. Key
  `'leads-page-v3'`.
- `countUnreadLeads`: add `AND trashed_at IS NULL`.
- `findStoredLead` is deliberately left unfiltered. Add a one-line why-comment there: a trashed or
  erased row must still block a re-create.

### Success Criteria:

#### Automated Verification:

- Migration applies to the local DB: `pnpm payload migrate` (run `git status src/migrations` first)
- `src/__tests__/lib/queries/leads.db.test.ts` (new): a trashed lead is absent from rows, from
  `newCount` and from `countUnreadLeads`; an untrashed sibling is present

#### Manual Verification:

- None for this phase. No UI can trash a lead yet.

---

## Phase 2: Trash, restore, erase, purge

### Overview

Add the server mutations and the cron step, and make the redelivery paths treat an erased lead as
settled.

### Changes Required:

#### 1. Display name

**File**: `src/lib/leads/lead-display-name.ts` (new)

**Intent**: One string for "which lead is this", shared by `/kosz` and the typed-name check.

**Contract**: `leadDisplayName({ id, name, email, phone }): string`. Returns the first non-blank of
name / email / phone, else `Zgłoszenie #<id>`.

#### 2. Data access

**File**: `src/lib/db/lead-trash.ts` (new)

**Intent**: The `/kosz` list read and the purge selector, mirroring `src/lib/db/vehicle-trash.ts`.

**Contract**:
- `fetchTrashedLeads(db): TrashedLeadRowT[]`, where a row is
  `{ id, name, email, phone, source, submittedAt, trashedAt }`. It selects
  `trashed_at IS NOT NULL AND erased_at IS NULL`, ordered by `trashed_at DESC`.
- `selectPurgeableLeadIds(db, days)` selects
  `trashed_at < now() - interval AND erased_at IS NULL`.

#### 3. Erase

**File**: `src/lib/leads/erase-lead.ts` (new)

**Intent**: The one place that turns a trashed lead into a tombstone, used by the action and the
purge. It refuses a lead that is not trashed. It never reads or writes `investments`.

**Contract**: `eraseTrashedLead(payload, id): Promise<DeleteForeverResultT>`.
- A missing row returns `error`; an untrashed row returns `not-trashed`; an already-erased row
  returns `ok`.
- Write with `overrideAccess` and `skipRevalidation`:
  - null out name, email, phone, address, scope, area, rawData, formQuestions;
  - `assets: []`;
  - `erasedAt: now`.

  `rawData` is a required-shape JSON array to `leadRawDataSchema`, so write `[]`, not null, if the
  schema demands it. Check `src/lib/leads/lead-schema.ts`.
- Then `deleteUnreferencedMedia(payload, previousAssetIds)`.

#### 4. Actions

**File**: `src/lib/actions/lead-trash.ts` (new)

**Intent**: Mirror `vehicle-trash.ts`, with a bulk trash.

**Contract**:
- `trashLeadsAction(ids: number[])`: set `trashedAt: now` on every listed lead not already trashed.
  Write serially, never `Promise.all` (shared Neon session, see `delete-unreferenced-media.ts:19`).
  An empty array returns `success: false` with a Polish message, and an unknown id is skipped.
- `restoreLeadAction(id)`: refuses an erased lead (the contents are gone) and otherwise clears
  `trashedAt`.
- `deleteLeadForeverAction(id, confirmName)`:
  1. Check `isNameConfirmed(confirmName, leadDisplayName(lead))`.
  2. Run `eraseTrashedLead`.

All three go through `protectedAction` (MANAGEMENT_ROLES) with tags `[...LEAD_TRASH_TAGS]`.

**File**: `src/lib/cache/tags.ts`: `LEAD_TRASH_TAGS = ['leads']`, with a why-comment that nothing
outside the zgłoszenia reads a lead. A separate `LEAD_DELETE_TAGS` is unnecessary: a reclaimed file
was by definition referenced by nothing cached.

#### 5. Purge

**Files**: `src/lib/leads/purge-trash.ts` (new), `src/app/(payload)/api/cron/cleanup/route.ts`

**Intent**: Erase leads trashed more than `ENTITY_TRASH_RETENTION_DAYS` ago, mirroring
`src/lib/fleet/purge-trash.ts`.

**Contract**:
- `purgeLeadTrash(payload, db): { purged, failed }` runs `purgeTrashedRows` with `eraseTrashedLead`.
  When `purged > 0` it calls `revalidateTag(CACHE_TAGS.leads, EXPIRE_NOW)`.
- The route adds `leadTrash: await runStep('leadTrash', …)` to the results object.

#### 6. Redelivery guards

**Files**: `src/lib/leads/capture-lead.ts`, `src/app/(frontend)/api/webhooks/landing/route.ts`

**Intent**: Treat an erased lead as settled, because the owner removed it on purpose.
- Without the `captureLead` guard, a tombstone whose notify status was still `pending` would be
  emailed to sales with empty fields.
- Without the landing guard, a late landing redelivery would hang fresh files on an invisible row.

**Contract**:
- `captureLead`: `if (!created && lead.erasedAt) return { lead, created }`, before the `runNotify`
  check.
- Landing route: `alreadyHeld` also counts as true when `lead.erasedAt` is set, so nothing is
  downloaded. Releasing the landing prefix is then claimed as normal: the owner chose to discard
  those files.

### Success Criteria:

#### Automated Verification:

- `src/__tests__/lib/actions/lead-trash.db.test.ts` (new, modelled on `vehicle-trash.db.test.ts`):
  - bulk trash hides the rows, and re-trashing is a no-op;
  - restore brings a row back;
  - a wrong typed name refuses;
  - forever on an untrashed lead refuses with `not-trashed`;
  - forever wipes the contents, keeps `source` / `externalId` / `submittedAt`, and sets `erasedAt`;
  - restore of an erased lead refuses.
- Same spec, **investment independence**:
  - a lead with two files is promoted, so the investment holds the same media ids;
  - a third file is attached to the lead only;
  - after trash + forever, the investment row is unchanged, both shared media rows still exist, and
    the lead-only media row is gone.
- `src/__tests__/lib/leads/store-lead.db.test.ts`: an erased `facebook_lead_ads` row with an
  `externalId`. `captureLead` with the same `(source, externalId)` returns `created: false`, the lead
  count does not change, and notify is not called (mock `@/lib/leads/notify`).
- `src/__tests__/lib/leads/purge-trash.db.test.ts` (new):
  - a lead trashed 31 days ago (`trashDaysAgo`, after adding `'leads'` to `TrashableTableT` in
    `src/__tests__/helpers/investment.ts`) is erased;
  - a lead trashed 29 days ago is not;
  - an already-erased one is not selected.
- `src/__tests__/app/(payload)/api/cron/cleanup/route.test.ts`: the `leadTrash` step is reported.
- `pnpm exec vitest run src/__tests__/lib/leads/capture-lead.test.ts` passes if such a unit spec
  exists. Otherwise the store-lead DB spec covers the guard.

#### Manual Verification:

- None for this phase. Covered by phase 4's end-to-end check.

---

## Phase 3: `/zgloszenia` — selection, bulk trash, „Bez plików"

### Overview

Add the checkbox column, the toolbar action and the filter.

### Changes Required:

#### 1. Query filter

**Files**: `src/lib/queries/leads.ts`, `src/app/(frontend)/zgloszenia/page.tsx`

**Intent**: Lists only leads with no files when the user asks.

**Contract**:
- `getLeadsPage` / `fetchLeadsPage` take `noFiles: boolean`, which joins the cache key as an
  argument.
- When it is true, the where AND-s `{ assets: { exists: false } }`. **Verify** that the Postgres
  adapter turns `exists: false` on a `hasMany` upload into "no `leads_rels` row with path `assets`".
  If it does not, select the qualifying ids in `src/lib/db` with
  `NOT EXISTS (SELECT 1 FROM leads_rels r WHERE r.parent_id = leads.id AND r.path = 'assets')` and
  pass `id: { in }`.
- `newCount` ignores the filter, as it already ignores search (see the `LeadsPageT.newCount` doc).
- The page reads `sp.noFiles === '1'`.

#### 2. Selection column

**File**: `src/components/tables/leads.tsx`

**Intent**: A leading `select` display column, following `catalogue-picker-table.tsx:30-70`.

**Contract**:
- `getLeadColumns` gains `onToggleSelect(id)` and `onTogglePage()`.
- The cell checkbox reads the selection from a `SelectedLeadIdsContext`, so columns are not rebuilt
  per click.
- The header checkbox is checked when every row on the page is selected and `indeterminate` when
  only some are.
- `enableHiding: false`, so `ColumnToggle` cannot hide it.

#### 3. Toolbar

**File**: `src/components/leads/leads-data-table.tsx` (+ a colocated `trash-leads-button.tsx` if the
table file grows past one concern)

**Intent**: Hold the `Set<number>` selection, clear it when `data` changes (paging, search, filter,
or a trash), and wire „Do kosza (N)" and „Bez plików".

**Contract**:
- `actions` slot: a button, rendered only when the selection is non-empty, that opens `ConfirmDialog`:
  - title „Przenieść N zgłoszeń do kosza?" (Polish plural);
  - description: they go to `/kosz` and are erased after 30 days, and investments stay untouched;
  - `confirmLabel` „Przenieś do kosza";
  - `variant="neutral"`, as in `TrashRowButton`.

  Then `settleAction(() => trashLeadsAction([...ids]))`, a toast, and a cleared selection.
- `filters` slot: `ActiveFilterButton` „Bez plików" bound to `updateParam('noFiles', on ? '1' : '')`.

### Success Criteria:

#### Automated Verification:

- `src/__tests__/components/leads/leads-data-table.test.tsx` (new, dom). Mock `trashLeadsAction`.
  - The header checkbox selects every row of the page.
  - „Do kosza (2)" appears with two selected.
  - Confirming calls the action with exactly those ids.
  - New `data` props clear the selection.
- `src/__tests__/lib/queries/leads.db.test.ts`: `noFiles` returns the lead without files and omits
  the one with a file.

#### Manual Verification:

- On `/zgloszenia`, „Bez plików" narrows the list, and the header checkbox + „Do kosza" removes the
  page's empty leads in one go.
- The „N nowych" count and the nav badge drop when untouched new leads are trashed.

---

## Phase 4: `/kosz` section and docs

### Overview

Add a plain „Zgłoszenia" section to `/kosz`, then update the docs that the change makes wrong.

### Changes Required:

#### 1. Trash kind

**Files**: `src/types/trash.ts`, `src/lib/queries/trash.ts`, `src/components/trash/trash-kinds.ts`

**Intent**: The `lead` kind, listed last (the least important section).

**Contract**:
- `TrashKindT` adds `'lead'`.
- `TrashListsT` / `getTrashContents` add `leads: fetchTrashedLeads(db)`.
- `shapeTrashRows` maps each lead to `{ ...base(row), kind: 'lead', name: leadDisplayName(row), detail }`.
  `detail` is the source label plus the submitted date, so two „Jan" leads are told apart.
- `TRASH_KINDS.lead`:
  - `sectionTitle` „Zgłoszenia"; `restored` „Zgłoszenie przywrócone.";
  - `lost` „dane kontaktowe, odpowiedzi z formularza i pliki, których nie ma w żadnej inwestycji";
  - `note` (static): investments created from the lead stay untouched;
  - `nameLabel` „Nazwa zgłoszenia"; `deleted` „Zgłoszenie usunięte na zawsze.".
- The source label comes from wherever `SOURCE_BADGE` in `tables/leads.tsx` gets it. If it is only
  in that client file, lift the labels to `src/lib/leads/` so the server-side shaper can read them.

#### 2. Docs

**Files**: `AGENTS.md` (Auth And Roles trash paragraph, if it lists kinds),
`context/foundation/lessons.md` (only if a new rule emerged), `context/foundation/test-plan.md`
(lead-removal risk row)

**Intent**: Record two durable rules:
- why a lead is erased in place rather than deleted (the reconcile cron);
- that `findStoredLead` and the media reference scan must never filter trashed leads.

### Success Criteria:

#### Automated Verification:

- `src/__tests__/lib/queries/trash.test.ts`: `shapeTrashRows` maps a lead row to kind `lead`, with
  the display-name fallback (email when the name is blank, then `Zgłoszenie #id`).
- Existing `src/__tests__/components/trash/*.test.tsx` still pass with the new kind (`TRASH_KINDS` is
  exhaustive over `TrashKindT`).

#### Manual Verification:

- `/kosz` shows a „Zgłoszenia" section listing the trashed leads with their days left. Przywróć
  returns a lead to `/zgloszenia`.
- Usuń na zawsze on a promoted lead with photos:
  - the typed name is required;
  - the lead disappears from `/kosz`;
  - the investment still shows every photo in its gallery.
- A Facebook lead deleted forever does not reappear on `/zgloszenia` after the next
  `leads-reconcile` run. Staging: trigger the cron route by hand.

---

## Testing Strategy

### Unit Tests:

- `leadDisplayName` fallbacks, via `shapeTrashRows` in `trash.test.ts`.
- The selection behaviour of `LeadsDataTable` (dom).

### Integration Tests:

- DB specs against 5435:
  - trash / restore / erase;
  - investment-files-survive (**the** regression guard of this change);
  - erased-Facebook-lead-not-recreated;
  - purge window;
  - reader filters and `noFiles`.

### Manual Testing Steps:

1. Trash three empty Facebook leads via „Bez plików", then check `/zgloszenia`, the badge and `/kosz`.
2. Restore one and confirm it is back with its answers intact.
3. Delete forever a promoted lead that has photos, then open the investment and confirm the gallery
   is complete.

## Migration Notes

The migration is additive: two nullable columns. It must land on prod **before** the push that ships
code reading `trashed_at` (AGENTS.md → Migrations; `pnpm db:migrate:prod`, run by a human). The
preview DB needs `pnpm db:migrate:preview` before staging is checked.

## Whole-tree Gate

Run once, after the final phase:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (unit + dom, under the machine-wide test lock)
- `pnpm test:integration`

## References

- Reference kind: `src/lib/actions/vehicle-trash.ts`, `src/lib/db/vehicle-trash.ts`,
  `src/lib/fleet/purge-trash.ts`, `context/changes/2026-10-01-kosz-floty-i-sprzetu/plan.md`
- Media reclaim: `src/lib/media/delete-unreferenced-media.ts`,
  `src/lib/media/relating-collections.ts`
- Resurrection path: `src/lib/leads/reconcile-sweep.ts`, `src/lib/leads/store-lead.ts`,
  `src/lib/leads/capture-lead.ts`
- Linear: EX-970

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Columns and hiding

#### Automated

- [x] 1.1 Migration applies to the local DB — 0ebd8937
- [x] 1.2 `leads.db.test.ts` — trashed lead hidden from rows, newCount and countUnreadLeads — 0ebd8937

### Phase 2: Trash, restore, erase, purge

#### Automated

- [x] 2.1 `lead-trash.db.test.ts` — trash / restore / forever / refusals
- [x] 2.2 `lead-trash.db.test.ts` — investment files survive erasing its lead
- [x] 2.3 `store-lead.db.test.ts` — erased Facebook lead not re-created, not notified
- [x] 2.4 `purge-trash.db.test.ts` — 30-day window, erased rows not reselected
- [x] 2.5 Cleanup route test reports `leadTrash`
- [x] 2.6 capture-lead unit spec passes (if present) (none present — covered by store-lead.db.test.ts)

### Phase 3: `/zgloszenia` — selection, bulk trash, „Bez plików"

#### Automated

- [ ] 3.1 `leads-data-table.test.tsx` — page select, bulk button, cleared on new data
- [ ] 3.2 `leads.db.test.ts` — `noFiles` filter

### Phase 4: `/kosz` section and docs

#### Automated

- [ ] 4.1 `trash.test.ts` — lead kind + display-name fallback
- [ ] 4.2 Existing trash component specs pass
