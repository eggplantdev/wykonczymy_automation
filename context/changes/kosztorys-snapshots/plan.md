# Kosztorys Snapshots (S-06) Implementation Plan

## Overview

Add a **durable version-history net** to the in-app kosztorys editor: a Manager+ user can save a
**named** snapshot of a kosztorys ("Zapisz jako…") and restore it later, reverting the whole tree
(sections + items + stages + stage_progress) **and** the investment's editor settings (coeffs +
VAT) to that point. The system also snapshots automatically — throttled every ~10 min on the edit
path, and **forced unconditionally right before any destructive op** (cascade delete, restore).
Architecture is **independent snapshots, not an event log** (owner decision): one row per snapshot
holding the serialized tree as `jsonb`; restore = **transactional wipe-and-reinsert**. Two kinds
only — `manual` (named, kept ~1 year) and `auto` (throttle + pre-destruction, kept newest-50 / ≤7
days). A daily GC cron enforces the age caps. This is the durable layer paired with S-07's
in-session undo; owner's north star for this slice is **keep it dead-simple**.

## Current State Analysis

- **The in-app kosztorys tree is 4 Payload collections**, all scoped by `investment_id`:
  `kosztorys-sections` → `kosztorys-items` (`section_id`) → `stage-progress` (`item_id`,
  `stage_id`), plus `kosztorys-stages`. FK cascades are DB-level (`ON DELETE CASCADE`) — deleting a
  section cascades its items → their progress; deleting a stage cascades its progress
  (`src/migrations/20260708_2_add_kosztorys_sections_items.ts:27`,
  `src/migrations/20260709_0_add_kosztorys_stages.ts:25-26`).
- **Editor settings live on `investments`**, not the tree: `w_tools_coeff`, `own_tools_coeff`
  (`20260708_2…:51-52`), `vat_rate` (`20260710_0_add_vat_rate_to_investments.ts`). They shape
  computed prices, so a faithful restore must capture and rewrite them.
- **All mutations** flow through `src/lib/actions/kosztorys.ts` via Payload local API, wrapped by
  `protectedAction` which hard-gates to `MANAGEMENT_ROLES` (`src/lib/actions/run-action.ts:40`).
  Cascade deletes use `payload.delete(...)` (`kosztorys.ts:151,192,292`); `removeStageAction` runs a
  raw-SQL progress guard first (`kosztorys.ts:286-291`).
- **Cache:** actions use `updateTag` via `revalidateCollections` (`src/lib/cache/revalidate.ts`);
  tags `kosztorysSections`, `kosztorysItems`, `kosztorysStages`, `stageProgress`
  (`src/lib/cache/tags.ts:9-12`). Because DB cascades bypass Payload's `afterDelete`, the actions
  manually add child tags on delete (`kosztorys.ts:154,295`).
- **Read path:** `getKosztorysTree(investmentId)` assembles the whole tree via 5 parallel
  `payload.find`/`findByID` calls at `depth:0` and returns `{ sections, stages, progress,
globalCoeffs, vatRate }` (`src/lib/queries/kosztorys.ts:23-118`). The natural basis for
  serialization.
- **Transactions exist but are unused here.** Pattern = `payload.db.beginTransaction()` + thread
  `req.transactionID` into Payload ops + `commit`/`rollback` (`src/lib/actions/transfers.ts:83-119`).
  `getDb(payload, req)` returns a transaction-scoped Drizzle executor when `req.transactionID` is
  present (`src/lib/db/get-db.ts:12-18`).
- **Raw-only table precedent:** `notification_reads` is created by migration and read/written via
  raw SQL with **no** Payload collection (`src/migrations/20260708_add_notification_reads.ts`,
  `src/lib/db/notifications.ts`). Right fit for a `jsonb`-payload snapshots table.
- **No scheduled-job infra exists yet** — no `vercel.json` crons, no cron route handlers, no Payload
  jobs. The daily GC cron in Phase 5 is the first.
- **The editor is `react-datasheet-grid`** (`src/components/kosztorys/kosztorys-editor-v2.tsx`,
  `use-kosztorys-editor.ts`). `lessons.md` warns: grid rows are `useState`-seeded at mount, so
  `router.refresh()` alone won't re-seed them after an out-of-band change — a total change like
  restore must **remount** the editor.

### Key Discoveries:

- **Wipe-and-reinsert minting new PKs is FK-safe.** Nothing outside the tree stores kosztorys
  item/section/stage ids as a business FK — transfers/expenses/sheets-sync key on transfer id +
  category (`src/lib/db/investment-financials.ts:11-49`, `src/collections/transfers.ts:123-254`).
  The only external refs are Payload's internal `payload_locked_documents_rels` columns
  (`src/migrations/20260709_1_fix_locked_docs_kosztorys_rels.ts`), which `ON DELETE CASCADE`
  harmlessly. This retires the roadmap's #1 open risk.
- **`getKosztorysTree` already produces the exact shape to serialize** — reuse it (or a `depth:0`
  sibling) rather than re-querying by hand.
- **`removeStageAction` blocks deleting a stage with recorded progress** (`kosztorys.ts:286-291`),
  so the forced pre-delete snapshot for stages only fires on a genuinely-allowed delete.

## Desired End State

The editor toolbar has a **"Wersje"** button opening a history drawer that lists snapshots (newest
first): **named `manual` versions are the prominent, targetable entries; `auto` snapshots are the
ambient timestamped history below them**, each with author. A **"Zapisz jako…"** button captures a
named version. Restoring a snapshot (single confirm) atomically reverts the whole kosztorys to that
point and the editor re-renders the restored tree. Automatic `auto` snapshots accrue during active
editing (≥10 min apart) and unconditionally before every destructive op. A daily GC cron keeps the
table bounded. No transfers/balances/marża write path is touched.

Verify: "Zapisz jako…" a version → edit → restore → the tree + prices return to the saved state;
delete a section → the forced pre-delete `auto` snapshot restores it; a wrong restore is itself
restorable via the forced pre-restore snapshot.

## What We're NOT Doing

- **No event sourcing / change log / per-field "who changed what" audit** (owner: point-in-time is
  enough).
- **No diffing, no partial/selective restore, no merge** — restore is whole-kosztorys, all-or-nothing.
- **No `safety` kind.** Pre-destruction protection is a _forced `auto` snapshot_, not a third kind
  with its own retention (owner simplification 2026-07-10).
- **No dedupe** on the forced pre-destruction snapshot — always take it; the GC cron reclaims it.
- **No relocation of coeffs/VAT** off `investments`; **no re-rooting** the tree onto a kosztorys
  entity; **no removal of the legacy `kosztoryses` table** (separate cleanup).
- **No general/other-data cleanup in the GC cron yet** — it prunes snapshots only, but is shaped so
  other cleanups can hang off it later.
- **No change to S-07 (undo)** — independent slice.

## Implementation Approach

Build bottom-up: (1) the table + a pure serialize/restore core with no triggers, so restore can be
exercised in isolation; (2) wire the automatic + named-manual **capture** triggers into the
existing actions, with inline count-cap pruning; (3) the **restore** action with its forced
pre-restore snapshot and cache revalidation; (4) the "Wersje" drawer UI; (5) the daily GC cron for
age-based cleanup. Snapshots are a **raw-only** table (migration + raw SQL, the `notification_reads`
pattern). Serialization reuses `getKosztorysTree`. Restore uses the `transfers.ts` transaction
pattern — the first transactional write in the kosztorys code, correct because it's the only
multi-write that must be atomic.

## Critical Implementation Details

- **Periodic `auto` is a plain client interval.** A 10-min interval on the mounted editor calls a
  dumb `snapshotAction` unconditionally — no server throttle, no activity/dirty check, no
  per-autosave SELECT. It fires even on an idle open editor (accepted now; GC + count cap bound it).
  The "skip when nothing changed" optimization is deferred to S-07, which lands the local edit-queue
  that makes a dirty signal cheap.
- **Forced pre-destruction snapshot is unconditional.** Before a cascade delete (`removeSectionAction`,
  `removeStageAction`) and as the first step of restore, insert an `auto` snapshot of exact current
  state **every time**, bypassing the throttle and without a dedupe check. This is what makes a
  cascade delete (which fast-undo S-07 explicitly refuses) and a wrong restore recoverable.
- **Restore ordering & atomicity.** Inside one transaction: (1) forced `auto`-snapshot current state
  → (2) wipe (delete sections → DB cascades items→progress; delete stages → cascades their progress)
  → (3) re-insert sections, then items (remap to new `section_id`), then stages, then progress
  (remap to new `item_id`/`stage_id`) → (4) rewrite the 3 investment settings. Thread
  `req.transactionID` into every Payload op (`transfers.ts:83-119`). On any error, rollback — the
  live tree must never be left half-wiped.
- **Restore cache + client.** After commit, `updateTag` all four kosztorys tags **and** the
  investments tag (settings changed) — mirror what the editor actions revalidate. The client must
  **remount** the editor (fresh `key`) on restore success, not rely on `router.refresh()`
  (`lessons.md`). A full remount is acceptable because restore intentionally discards
  sort/filter/optimistic state anyway.
- **Tolerant deserialization.** Restore maps only fields it knows for the payload's `schema_version`,
  defaults anything missing, ignores unknown extras — so a later additive migration doesn't break
  old snapshots. A non-additive change (rename/drop) is the one case that needs the restore mapper
  updated for that version.

## Phase 1: Schema + serialization/restore core

### Overview

Create the `kosztorys_snapshots` table and a pure server-side serialize + restore pair, with **no
triggers and no UI**. At the end of this phase a snapshot can be created and restored by calling
functions directly, proving the dangerous wipe-and-reinsert works before anything calls it
automatically.

### Changes Required:

#### 1. Migration — `kosztorys_snapshots` table

**File**: `src/migrations/20260710_1_add_kosztorys_snapshots.ts` (hand-written; follow AGENTS.md)

**Intent**: Additive raw-only table holding one serialized snapshot per row, scoped to an
investment, cascade-deleted with it. No Payload collection.

**Contract**: Columns — `id serial PK`; `investment_id integer NOT NULL REFERENCES
investments(id) ON DELETE CASCADE`; `taken_at timestamptz NOT NULL DEFAULT now()`; `taken_by
integer` (Payload `users.id`, nullable, `ON DELETE SET NULL`); `kind varchar NOT NULL`
(`'manual' | 'auto'`); `label varchar` (nullable; required-at-app-level only for `manual`);
`schema_version integer NOT NULL`; `payload jsonb NOT NULL`. Indexes: `(investment_id, taken_at
DESC)` for list + throttle lookup, `(investment_id, kind, taken_at)` for retention pruning. Do
**not** register a Payload collection or touch `payload_locked_documents_rels`.

#### 2. Snapshot payload shape + version constant

**File**: `src/lib/kosztorys/snapshot-format.ts` (new)

**Intent**: Define the versioned payload type and `SNAPSHOT_SCHEMA_VERSION` (start at `1`), so
serialize and restore share one contract.

**Contract**: `SnapshotPayloadT` capturing `sections[]`, `items[]` (with `sectionId` ref),
`stages[]`, `progress[]` (with `itemId`/`stageId` refs), and `settings` (`wToolsCoeff`,
`ownToolsCoeff`, `vatRate`) — column-parity with the four tables + the three investment fields.
`SNAPSHOT_SCHEMA_VERSION = 1 as const`. Type suffix `T` per repo convention.

#### 3. Serialize function

**File**: `src/lib/kosztorys/serialize-kosztorys.ts` (new)

**Intent**: Read the current committed tree + settings for an investment and produce a
`SnapshotPayloadT` stamped with the current version. Reuse `getKosztorysTree` (or a `depth:0`
sibling).

**Contract**: `serializeKosztorys(payload, investmentId): Promise<SnapshotPayloadT>`. Pure read; no
writes. Preserve `displayOrder`/`ordinal` so restore rebuilds order deterministically.

#### 4. Restore function (transactional)

**File**: `src/lib/kosztorys/restore-kosztorys.ts` (new)

**Intent**: Given an investment + a `SnapshotPayloadT`, atomically wipe the live tree and re-insert
from the payload, remapping child FKs to freshly-minted parent ids, and rewrite the investment
settings. Tolerant to `schema_version`.

**Contract**: `restoreKosztorys(payload, req, investmentId, snapshot): Promise<void>` — **caller
owns the transaction**. Insert order: sections → items → stages → progress → settings, keeping an
old-id→new-id map for sections and items/stages. Uses Payload local API ops threaded with `req`.

### Success Criteria:

#### Automated Verification:

- [ ] Migration applies cleanly against the local DB: `pnpm payload migrate` (local only)
- [ ] Type checking passes: `pnpm generate:types && pnpm tsc --noEmit`
- [ ] Lint passes: `pnpm lint`
- [ ] Round-trip test: `restoreKosztorys(serializeKosztorys())` is an identity on tree content + order (new ids)

#### Manual Verification:

- [ ] On a seeded investment (`INV=6`), serialize → mutate → restore returns the tree to the serialized state
- [ ] An injected mid-restore error leaves the live tree intact (rollback), not half-wiped
- [ ] Restored subcontractor/brutto prices match pre-restore values (settings rewritten)

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Capture triggers (10-min interval auto + named manual + forced pre-delete) + inline pruning

### Overview

Add the capture paths and inline count-cap pruning. No restore UI yet — this phase only _creates_
snapshots. The periodic `auto` snapshot is a **plain client-side 10-min interval on the open
editor** that fires unconditionally — **no server throttle, no activity check** (owner: keep it
dead-simple now; the "skip when nothing changed" check is deferred to the undo-queue slice S-07,
which introduces the local edit-queue that makes a dirty-signal cheap — recorded in `roadmap.md`).

### Changes Required:

#### 1. Client 10-min interval → `snapshotAction`

**File**: `src/components/kosztorys/kosztorys-editor-v2.tsx` (interval) + `src/lib/actions/kosztorys.ts`
(`snapshotAction`)

**Intent**: While the editor is mounted, a 10-min interval calls `snapshotAction(investmentId)`
unconditionally. The server action is **dumb** — serialize + insert `auto` + prune, no throttle,
no per-autosave SELECT.

**Contract**: `snapshotAction(investmentId)` via `protectedAction` (MANAGEMENT_ROLES): serialize
→ `insertSnapshot(kind:'auto')` → `pruneAutoCount`. Client interval `10 * 60 * 1000` as a named
constant; clear it on unmount. Fire-and-forget (a failed snapshot must not disrupt editing). The
interval fires even on an idle open editor — accepted for now; GC + the count cap bound it, and the
S-07 activity check will suppress idle snapshots later.

#### 2. Insert + retention + listing helpers

**File**: `src/lib/db/snapshots.ts` (new — raw SQL, `notification_reads` style)

**Intent**: The single place that reads/writes the raw table: `insertSnapshot`, `listSnapshots`,
`pruneAutoCount`, `gcSnapshots`.

**Contract**: `pruneAutoCount(db, investmentId)` keeps only the newest **50** `auto` snapshots per
investment (inline, on insert). `listSnapshots` returns metadata only (id, kind, label, taken_at,
taken_by — **not** `jsonb payload`). `insertSnapshot` stamps `schema_version`. `gcSnapshots` (used
by Phase 5) deletes `auto` older than **7 days** and `manual` older than **~1 year**.

#### 3. Named manual snapshot action

**File**: `src/lib/actions/kosztorys.ts` (add `saveSnapshotAction`)

**Intent**: Serialize now and store as `kind:'manual'` with a **required** label; ignores the
throttle.

**Contract**: `saveSnapshotAction(investmentId, label)` via `protectedAction` (MANAGEMENT_ROLES).
Zod-validate `label` as a **required, non-empty** string. Returns `ActionResultT`. Manual snapshots
are exempt from the inline count cap.

#### 4. Forced pre-delete snapshot

**File**: `src/lib/actions/kosztorys.ts` (`removeSectionAction`, `removeStageAction`)

**Intent**: Before the `payload.delete` cascade, **unconditionally** insert a `kind:'auto'` snapshot
of exact current state (then `pruneAutoCount`), so the deleted subtree is recoverable.

**Contract**: Insert the forced `auto` snapshot **before** the delete call; `removeStageAction` keeps
its existing progress guard. `removeItemAction` (single-row) does **not** snapshot — single-row
delete is S-07 undo's job.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes
- [ ] Lint passes
- [ ] Unit test: `pruneAutoCount` keeps newest 50 auto, never touches manual
- [ ] Unit test: `saveSnapshotAction` rejects an empty label

#### Manual Verification:

- [ ] An open editor produces one `auto` snapshot per ~10-min interval; the interval clears on unmount
- [ ] "Zapisz jako…" with a name creates a `manual` row with that label
- [ ] Deleting a section/stage creates an `auto` row immediately before the delete, every time
- [ ] After 50+ auto snapshots on one investment, only the newest 50 remain

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Restore action + forced pre-restore snapshot + listing

### Overview

Expose restore as a gated server action that wraps the Phase-1 restore core in a transaction, takes
a forced pre-restore `auto` snapshot, and revalidates caches. Add the list action the drawer needs.

### Changes Required:

#### 1. `restoreSnapshotAction`

**File**: `src/lib/actions/kosztorys.ts`

**Intent**: Load a snapshot by id, forced-`auto`-snapshot the current state (pre-restore net), then
run `restoreKosztorys` inside one transaction, then revalidate.

**Contract**: `restoreSnapshotAction(snapshotId)` via `protectedAction` (MANAGEMENT_ROLES). Resolve
`investment_id` from the snapshot row (don't trust a client-passed investment). Open
`payload.db.beginTransaction()`, thread `req.transactionID`, forced `auto`-snapshot →
`restoreKosztorys` → commit (rollback on error). After commit, `updateTag` the four kosztorys tags +
investments tag. Returns `ActionResultT`.

#### 2. `listSnapshotsAction`

**File**: `src/lib/actions/kosztorys.ts`

**Intent**: Return snapshot metadata (no payload) for an investment, newest first, for the drawer.

**Contract**: `listSnapshotsAction(investmentId)` via `protectedAction`. Delegates to
`listSnapshots`. Resolve `taken_by` to a display name for attribution.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes
- [ ] Lint passes
- [ ] Integration test: `restoreSnapshotAction` reverts a mutated tree and creates exactly one forced `auto` snapshot; assert **persisted** state, not the return value
- [ ] Integration test: restore is gated — a non-MANAGEMENT role gets `Brak uprawnień`

#### Manual Verification:

- [ ] Restore reverts the tree + prices; a following restore of the auto-created pre-restore snapshot returns to the pre-restore state (mis-restore recoverable)
- [ ] Restore fires revalidation — the editor shows restored data without a hard reload (after Phase 4 remount)
- [ ] Restore never touches transfers/balances/marża (spot-check financial figures before/after)

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: "Wersje" drawer UI

### Overview

The user-facing surface: a toolbar button opening a history drawer, a "Zapisz jako…" named-save
button, and a single-confirm restore that remounts the editor on success.

### Changes Required:

#### 1. "Wersje" toolbar button + history drawer

**File**: `src/components/kosztorys/` (new drawer component + toolbar wiring in
`kosztorys-editor-v2.tsx`)

**Intent**: A drawer listing snapshots newest-first — **named `manual` versions prominent and
targetable, `auto` snapshots as ambient timestamped history** — each with author and a Restore
control.

**Contract**: Uses the existing UI drawer/sheet primitive from `src/components/ui`. Calls
`listSnapshotsAction` on open. Polish labels; English code. Empty state when no snapshots yet.

#### 2. "Zapisz jako…" named-save button

**File**: `src/components/kosztorys/kosztorys-editor-v2.tsx` (+ small dialog)

**Intent**: Toolbar button prompting for a **required** name, calling `saveSnapshotAction`, then
refreshing the drawer list.

**Contract**: The dialog disables confirm on empty input. On success show a toast and re-fetch the
list.

#### 3. Restore confirm + editor remount

**File**: drawer component + `kosztorys-editor-v2.tsx`

**Intent**: Restore row → single confirm dialog (message states current state is saved as a restore
point) → `restoreSnapshotAction` → on success **remount** the editor with a fresh `key`.

**Contract**: Confirm copy in Polish, e.g. "Przywrócić wersję z <data>? Obecny stan zostanie
zapisany jako punkt przywracania." On success, bump the editor's remount key so the grid re-seeds
from the restored tree (per `lessons.md`); close the drawer; toast.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes
- [ ] Lint passes
- [ ] E2E (Playwright, `db-test`): "Zapisz jako…" a version → edit a cell → restore → grid shows the saved value

#### Manual Verification:

- [ ] Drawer lists named manual versions prominently and auto snapshots as timestamped history, with author
- [ ] Restore shows the confirm dialog and, on confirm, the grid reflects the restored tree without a hard reload
- [ ] "Zapisz jako…" requires a name; the label appears in the list; canceling does nothing
- [ ] Restore of a ~1000-row kosztorys completes acceptably and re-renders correctly

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: Daily GC cron (age-based cleanup)

### Overview

A daily scheduled job that enforces **age** caps globally — including on dormant kosztorysy that
inline pruning never revisits. Shaped so future stale-data cleanups can hang off the same job.

### Changes Required:

#### 1. Cron route handler

**File**: `src/app/(payload)/api/cron/cleanup/route.ts` (new)

**Intent**: A `CRON_SECRET`-guarded endpoint that runs `gcSnapshots` (deletes `auto` older than 7
days, `manual` older than ~1 year) and returns a summary count.

**Contract**: Verify the `Authorization: Bearer <CRON_SECRET>` header (reject otherwise); read
`CRON_SECRET` through the validated env layer (`src/lib/env/`), never raw `process.env`. Call
`gcSnapshots` (from `src/lib/db/snapshots.ts`). Structure the handler so additional cleanup steps
can be appended later.

#### 2. Vercel Cron registration

**File**: `vercel.json` (new — first cron in the repo)

**Intent**: Register a daily schedule hitting the cleanup route.

**Contract**: One `crons` entry, daily schedule, path `/api/cron/cleanup`. Add `CRON_SECRET` to the
env schema and to Vercel env (human step). Daily granularity works on all Vercel plan tiers.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes
- [ ] Lint passes
- [ ] Unit test: `gcSnapshots` deletes auto >7 days and manual >1 year, keeps the rest
- [ ] Route rejects a request without the correct `CRON_SECRET`

#### Manual Verification:

- [ ] Hitting the endpoint with the secret prunes aged snapshots and returns a count
- [ ] A dormant kosztorys's aged `auto` snapshots are removed by the job (inline pruning never would)
- [ ] `CRON_SECRET` is set in Vercel and the scheduled run appears in Vercel cron logs (post-deploy)

**Implementation Note**: Final phase — run the slice-review gate before archiving.

---

## Testing Strategy

### Unit Tests:

- `pruneAutoCount` (newest-50 auto, manual untouched) and `gcSnapshots` (age caps)
- `maybeSnapshot` throttle decision with an injected clock
- `saveSnapshotAction` empty-label rejection
- serialize → restore round-trip identity on tree content + order

### Integration Tests:

- `restoreSnapshotAction` reverts persisted state and creates one forced `auto` snapshot (assert DB, not return value)
- restore access gate (non-MANAGEMENT rejected)
- restore rollback leaves the tree intact on injected error

### Manual Testing Steps:

1. Seed `INV=6`, edit >10 min, confirm auto snapshots ~10 min apart.
2. "Zapisz jako…" a named version, edit, restore it, confirm tree + prices revert.
3. Delete a section, confirm a forced `auto` snapshot was taken, restore it.
4. Restore a version, then restore the auto pre-restore snapshot to confirm mis-restore recovery.
5. Confirm financial figures (bilans/marża) unchanged across a restore.
6. Run the cron endpoint, confirm aged snapshots are pruned.

## Performance Considerations

- The 10-min throttle keeps serialization rare; the hot path is a single indexed timestamp SELECT.
- A full serialize/restore touches ~1000 rows at the top end — acceptable for a rare op; restore is
  one transactional commit. `listSnapshots` never loads `jsonb payload`.
- Frequency at 10 min is a starting point — if the table grows too large, lengthen the window or
  tighten retention (owner: "we'll see if it grows too large").
- The periodic snapshot is a **plain client 10-min interval** calling a dumb `snapshotAction` — no
  server throttle, nothing on the autosave hot path. It fires unconditionally (even idle); the
  activity/dirty check that suppresses idle snapshots is **deferred to S-07** (the undo-queue slice
  that introduces the local edit-queue) — recorded in `roadmap.md`. The forced pre-destruction
  snapshot stays server-side + unconditional.

## Migration Notes

- One additive migration; local-only until the code ships (`pnpm db:migrate:prod` is a human,
  deploy-time step — order: migrate prod before pushing code that reads the table).
- `CRON_SECRET` must be added to the env schema and to Vercel before the cron works in production.

## References

- Roadmap slice S-06: `context/foundation/roadmap.md`
- Change identity + owner decisions: `context/changes/kosztorys-snapshots/change.md`
- Transaction pattern: `src/lib/actions/transfers.ts:83-119`
- Raw-only table precedent: `src/lib/db/notifications.ts`, `src/migrations/20260708_add_notification_reads.ts`
- Read path to reuse: `src/lib/queries/kosztorys.ts:23`
- Grid remount lesson: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema + serialization/restore core

#### Automated

- [x] 1.1 Migration applies cleanly against the local DB — 0e6cd47
- [x] 1.2 Type checking passes — 0e6cd47
- [x] 1.3 Lint passes — 0e6cd47
- [x] 1.4 Serialize→restore round-trip identity test passes — 0e6cd47

#### Manual

- [ ] 1.5 Serialize → mutate → restore returns the tree to the serialized state
- [ ] 1.6 Injected mid-restore error rolls back (tree intact)
- [ ] 1.7 Restored subcontractor/brutto prices match pre-restore (settings rewritten)

### Phase 2: Capture triggers + inline pruning

#### Automated

- [x] 2.1 Type checking passes — b3a8044
- [x] 2.2 Lint passes — b3a8044
- [x] 2.3 `pruneAutoCount` unit test passes — b3a8044
- [x] 2.4 `saveSnapshotAction` empty-label rejection test passes — b3a8044

#### Manual

- [ ] 2.5 Open editor produces one auto snapshot per ~10-min interval; interval clears on unmount
- [ ] 2.6 "Zapisz jako…" creates a labelled manual row
- [ ] 2.7 Section/stage delete creates a forced auto row before the delete
- [ ] 2.8 Only the newest 50 auto snapshots remain after a burst

### Phase 3: Restore action + forced pre-restore snapshot + listing

#### Automated

- [x] 3.1 Type checking passes — c062b3d
- [x] 3.2 Lint passes — c062b3d
- [x] 3.3 Restore integration test (persisted state + one forced auto snapshot) passes — c062b3d
- [x] 3.4 Restore access-gate test passes — c062b3d

#### Manual

- [ ] 3.5 Restore reverts tree + prices; mis-restore recoverable via the pre-restore snapshot
- [ ] 3.6 Restore revalidates caches (editor updates without hard reload)
- [ ] 3.7 Restore leaves transfers/balances/marża untouched

### Phase 4: "Wersje" drawer UI

#### Automated

- [x] 4.1 Type checking passes — 78c017d
- [x] 4.2 Lint passes — 78c017d
- [ ] 4.3 E2E save→edit→restore passes

#### Manual

- [ ] 4.4 Drawer lists manual versions prominently + auto as timestamped history, with author
- [ ] 4.5 Restore confirm → grid reflects restored tree without hard reload
- [ ] 4.6 "Zapisz jako…" requires a name; label appears; cancel does nothing
- [ ] 4.7 ~1000-row restore completes acceptably and re-renders correctly

### Phase 5: Daily GC cron

#### Automated

- [x] 5.1 Type checking passes
- [x] 5.2 Lint passes
- [x] 5.3 `gcSnapshots` age-cap unit test passes
- [x] 5.4 Route rejects a request without the correct `CRON_SECRET`

#### Manual

- [ ] 5.5 Endpoint with secret prunes aged snapshots and returns a count
- [ ] 5.6 A dormant kosztorys's aged auto snapshots are removed by the job
- [ ] 5.7 `CRON_SECRET` set in Vercel; scheduled run appears in cron logs (post-deploy)
