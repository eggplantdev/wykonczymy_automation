# Investor change history — Implementation Plan

## Overview

The investor, on their share link (`/k/[token]`), can open a list of the days on which their kosztorys
changed, open any of them, and see what changed **since that day** compared with the current version:
added pozycje, removed pozycje, and values that went from old to new (Przedmiar, Cena j.m., Pomiar per
etap, wartość, rabat). The owner sees the same screen in „Podgląd dla inwestora". Built on the existing
`kosztorys_snapshots` table. Design and owner decisions: `design.md` (Linear EX-881).

## Current State Analysis

- `kosztorys_snapshots` (`src/lib/db/snapshots.ts`) stores the whole tree as jsonb, with
  `kind ∈ {'manual','auto'}` (a plain `varchar`, no enum or CHECK — a new kind needs no DDL).
- `auto` rows are written every 10 min, and only while the editor is open (`use-auto-snapshot.ts`), and
  are also forced before a restore or delete (`capture-auto-snapshot.ts`).
- `manual` rows mix two things: the owner's „Zapisz jako…" (`saveSnapshotAction`) and system points
  labelled `Przed wczytaniem: …` (`reload-from-preset.ts:10`), `Przed importem z arkusza Google`
  (`actions/kosztorys-import.ts:38`) and `Przed wyczyszczeniem` (`actions/kosztorys.ts:298`). On the
  local dump there are 88 system rows and 4 user-named rows.
- Retention: `gcSnapshots` has a 365-day ceiling for every row. `auto` rows keep only the newest per
  Warsaw day from day 30 to day 120, then the newest per Warsaw week. It runs from `cron/cleanup`
  (`0 3 * * *`).
- `serializeKosztorys` goes through `getKosztorysTree`, which does `requireAuth(MANAGEMENT_ROLES)`, so a
  cron cannot call it. `buildKosztorysTree` (`src/lib/queries/kosztorys.ts:33`) is the guard-free body
  and already returns `globalDiscount`.
- The payload deliberately leaves out the global rabat (`snapshot-format.ts`, `SnapshotSettingsT`).
- Investor view: both pages render `KosztorysEditorBody preview` from `getPreviewKosztorysByToken` or
  `ById` (`src/lib/queries/preview-kosztorys.ts`). The token→investment lookup is inlined in
  `ByToken` and is uncached, so revoking a link takes effect immediately.
- The grid seeds its rows from `tree` once (`use-kosztorys-editor.ts:178`).
- **The preview hides empty settlement columns by data** (EX-client-view-auto-columns, `e882bef8`):
  `use-kosztorys-editor.ts:504` adds `emptySettlementColumnIds(rows, stages)` to the client's hidden
  set — an etap with no entries loses its Pomiar and wartość columns, and with no entries anywhere
  the „razem"/„% wykonania" totals go too. It is computed over the rows the grid renders.
- **The worker page reuses the same preview body** (`worker-kosztorys-page.tsx`, `worker` prop,
  `0e1f9553`), with its own token table `kosztorys-worker-shares`. Anything added to the preview
  header shows to the worker unless it is gated on `!worker`.
- Investments have no completion date. `status` changes only through Payload `update`
  (`updateInvestmentAction`, or `/admin`), and the `guardInvestmentStatusUnlock` beforeChange hook
  already sits on that path.

## Desired End State

- **Nightly capture:** every night one end-of-day version (`kind='daily'`) is stored for each Planowana
  or Aktywna investment whose kosztorys differs from its previous end-of-day version. It is stamped at
  the end of the Warsaw day it describes and carries the global rabat.
- **Named versions:** „Zapisz jako…" writes `kind='named'`.
- **Retention:** `daily` and `named` rows are never deleted while the investment is Planowana or
  Aktywna. After Zakończona they are deleted a year after `completed_at`, and reopening clears
  `completed_at`. `auto` and `manual` rows keep exactly today's rules.
- **History button:** the investor view shows „Historia zmian". It opens a dialog listing the changed
  days (newest first, each with a one-line summary) plus the named milestones.
- **Opening a day:** it navigates to `?wersja=<snapshotId>`. The grid then shows that version against
  the current one: added pozycje are listed above the grid, removed ones are struck through, and changed
  cells show old → new. A rabat line shows old → new, or „rabat nieznany" for versions stored before
  this ships. The money panel is hidden.
- **Access and failure behaviour:** a `wersja` id that doesn't belong to the link's investment, or isn't
  a visible kind, renders as the current view, with nothing leaked. A hidden column stays hidden in
  history.
- **Verification:** unit specs for the diff and selection, DB specs for capture, retention and scoped
  reads, a DOM spec for the history rendering, and the Whole-tree Gate passing.

### Key Discoveries:

- `gcSnapshots` bands are keyed on `kind = 'auto'` (`snapshots.ts:143,159`). A new kind is untouched by
  the bands automatically. Only the 365-day ceiling (`:128`) needs a kind- and status-aware predicate.
- System manual rows are recognisable only by their label prefix. Under the owner's "old rules for old
  rows", nothing is migrated: past user-named `manual` rows stay `manual`. They keep the 365-day
  ceiling and are **not** investor milestones. Only „Zapisz jako…" rows written after ship are.
- `restoreKosztorys` never reads a rabat from the payload, and the restore dialog already says the rabat
  stays today's (`kosztorys-versions-drawer.tsx:125`). Adding the rabat to the payload is therefore
  display-only, with no behaviour change on restore.
- `getSnapshot` (`snapshots.ts:78`) resolves the investment from the row. It is the scoping precedent:
  the history read must check `row.investment_id === tokenInvestmentId` and the kind, and fail closed.
- The owner's drawer filters `kind === 'manual'` / `'auto'` (`kosztorys-versions-drawer.tsx:70-71`).
  Unless it is taught the new kinds, `named` versions would vanish from the owner's restore list.
- Id matching breaks across a restore or „wczytaj szablon", which mint new ids. `keyItems`
  (`sheet-import/item-key.ts:47-63`) is the existing section + opis + occurrence key; j.m. is added on
  top. The fallback runs per pozycja over whatever id matching left unmatched on both sides — broader
  than design #14's "when the id sets are disjoint", so a restore followed by new pozycje still
  matches. The accepted side effect: deleting a pozycja and re-adding one with the same sekcja + opis +
  j.m. reads as one changed pozycja, which is what the investor sees on paper anyway.
- A trashed investment is never reached by the nightly job, and its share link resolves as unknown.
  The trash purge (`selectPurgeableInvestmentIds`) deletes only investments whose kosztorys was never
  used, so a used, trashed investment keeps its `daily`/`named` rows until it is restored — which is
  what makes a restore from the kosz bring its history back. No retention rule is needed for it.

## What We're NOT Doing

- A history of the money block (Wpłaty, materiały, Do zapłaty).
- Comparing two arbitrary past days, or an "od" picker. The comparison is always against the current
  version.
- Previewing a version in the owner's „Wersje" drawer. It stays restore-only and only learns the two new
  kinds.
- Changing the 10-min auto capture, the `auto` thinning bands, or restore behaviour.
- Reclassifying past `manual` rows ("old rules for old rows").
- Letting the owner hide a day (#15), or storing a per-day summary (it is computed on read).

## Implementation Approach

The work is mostly additive on the existing snapshot table:

- Two new kinds, `daily` and `named`, split investor-visible history from ambient restore points without
  touching the bands.
- A nullable `completed_at` column feeds retention.
- Everything the investor sees is derived on read by a **pure** library in `src/lib/kosztorys/history/`
  (snapshot → tree, diff, per-day selection, summary). The riskiest logic is therefore unit-testable
  without a DB.
- The read path is two new guarded entrances next to the existing preview ones and shares one extracted
  token resolver.
- The UI reuses `KosztorysEditorBody preview` through one optional `history` prop rather than a second
  grid.

## Critical Implementation Details

- **Day attribution / cron timing.** Schedule the nightly job at `15 23 * * *` UTC, which is 00:15 in
  Warsaw in winter and 01:15 in summer. That is always after Warsaw midnight, so the day the run
  describes is always **the previous Warsaw day**: `warsawToday(now) − 1`. Stamp `taken_at` = that day's
  last instant in Warsaw (`23:59:59.999 Europe/Warsaw` → UTC), never the run time.
  - Edits made between Warsaw midnight and the run (15 min in winter, 75 min in summer) land in the
    previous day's version. This window is accepted and must be written into the route's docblock.
  - A slot before midnight in one season would instead push that season's late edits a day forward and
    make the attribution rule depend on the date.
- **The list's per-day state.** For each Warsaw day, the version is that day's `daily` row. For days
  **before the investment's first `daily` row** it is the newest `auto` row that day (pre-ship
  history, design #11).
  - After the first `daily` row exists, `auto` rows are ignored for the list. The nightly job skips an
    unchanged day, so that day has no `daily` row, and its newest `auto` may be an intermediate state
    (the editor was closed within 10 min of the last edit). Listing it would show a state that never
    was the end of the day.
- **Change detection** compares the freshly built payload with the investment's latest `daily` payload
  using `isDeepStrictEqual` (`node:util`) on parsed objects. Never compare JSON strings: jsonb reorders
  keys. There is no hash column; ~65 investments × ≤24 kB per night is trivial.
- **Sequential inserts** in the cron — `for … of`, never `Promise.all` (lesson L2109). Each investment
  runs in its own try/catch, so one bad tree doesn't stop the rest, and the response returns the counts
  (`stored`, `unchanged`, `failed`), like `cron/cleanup`.
- **The rabat in old payloads is `undefined`, not 0** (lessons L751/L781). The type makes it optional
  and the diff carries a three-state value (`known` / `unknown`). Rendering `?? 0` is the bug this
  prevents.

## Phase 1: Data foundation

### Overview

`completed_at` is added and maintained. The kinds `daily` and `named` exist, and „Zapisz jako…" writes
`named`. The payload carries the global rabat, and restore keeps ignoring it.

### Changes Required:

#### 1. Migration `20260928_3_investment_completed_at.ts`

**File**: `src/migrations/20260928_3_investment_completed_at.ts` (+ register in `src/migrations/index.ts`)

**Intent**: Add a nullable `completed_at timestamptz(3)` to `investments` and backfill it from
`updated_at` for rows that are already `status = 'completed'`. The owner chose last-updated as the
backfill.

**Contract**: The migration is additive and hand-written, following the `20260928_0` pattern. `down`
drops the column. It is additive, so it migrates prod **before** the push (AGENTS.md → Migrations).

#### 2. Collection field + stamping hook

**File**: `src/collections/investments.ts`, new `src/hooks/investments/stamp-completed-at.ts`

**Intent**: Declare `completedAt` (`type: 'date'`, `admin.hidden`), so it is in the drizzle schema and
the types. A beforeChange hook sets it to now on a transition **into** `completed` and clears it to
`null` on a transition **out** of it. Any other write leaves it untouched.

**Contract**: The hook is `CollectionBeforeChangeHook` and runs after `guardInvestmentStatusUnlock` in
the `beforeChange` array. A refused unlock therefore never clears the date. It compares
`originalDoc.status` with `data.status` through `isLockedStatus`. A create with `status: 'completed'`
stamps too.

#### 3. Snapshot kinds + „Zapisz jako…"

**File**: `src/lib/db/snapshots.ts`, `src/lib/actions/kosztorys-snapshots.ts`, `src/components/kosztorys/editor/dialogs/kosztorys-versions-drawer.tsx`

**Intent**: Widen the kind type and make `saveSnapshotAction` write `named`. In the owner's drawer,
`named` goes in the named section and `daily` goes in the automatic history, so neither disappears from
the restore list.

**Contract**: `SnapshotKindT = 'manual' | 'auto' | 'named' | 'daily'`. Put the retention policy comment
at the top of `snapshots.ts` in its own paragraph, explaining that `named` and `daily` are
investor-visible.

#### 4. Global rabat in the payload

**File**: `src/lib/kosztorys/snapshot-format.ts`, `src/lib/kosztorys/serialize-kosztorys.ts`

**Intent**: Add `globalDiscount: { type: 'amount' | null; value: number }` to `SnapshotPayloadT`, filled
by the serializer from `tree.globalDiscount`, and **optional** in `StoredSnapshotPayloadT`. There is no
`SNAPSHOT_SCHEMA_VERSION` bump, because the field is additive and restore never reads it.

**Contract**:

- Rewrite the comment above `SnapshotSettingsT`: the rabat IS captured now, for display only, and
  restore still ignores it.
- Rewrite the "delete the stored rows — snapshots" exit in the bump comment: investor-visible kinds
  (`daily`, `named`) must be **migrated**, not deleted, and deletion stays allowed only for
  `auto`/`manual`.
- Add a pure `serializeTree(tree)` step, split out of `serializeKosztorys`, so the cron can serialize a
  `buildKosztorysTree` result without the auth guard.

### Success Criteria:

#### Automated Verification:

- The migration applies to local 5433 and to the 5435 test DB: `pnpm payload migrate`.
- Hook unit spec: stamps on → completed, clears on completed → active/planowana, is untouched on other
  writes, and a refused unlock does not clear it
  (`src/__tests__/hooks/investments/stamp-completed-at.test.ts`).
- Round-trip DB spec: a serialized payload carries `globalDiscount`, and restoring it leaves the live
  `globalDiscountValue` unchanged. This is the bridge test (L530/L40), extending
  `src/__tests__/lib/kosztorys/serialize-restore-roundtrip.test.ts`.
- DB spec: `saveSnapshotAction` stores `kind='named'`.

#### Manual Verification:

- Mark an investment Zakończona in the app, then reopen it. `completed_at` is set, then cleared (check
  with psql on 5433).
- In the owner's „Wersje" drawer, a new „Zapisz jako…" version appears in the named section.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Nightly capture and status-aware retention

### Overview

A new cron stores one `daily` version per changed investment per night. `gcSnapshots` keeps `daily` and
`named` rows for as long as the status rules say.

### Changes Required:

#### 1. Capture library

**File**: new `src/lib/kosztorys/capture-daily-snapshots.ts`, plus queries in `src/lib/db/snapshots.ts`

**Intent**: Capture a version for each eligible investment:

- The eligible set is `status IN ('planowana','active') AND trashed_at IS NULL`. The status list
  already excludes `szablon` and `completed` (L1672).
- For each one: build the tree with `buildKosztorysTree` (uncached, L1212), `serializeTree` it, compare
  it with the latest `daily` payload, and insert `kind='daily'` at the attributed `taken_at` when it
  differs or when no `daily` row exists yet.

**Contract**:

- `captureDailySnapshots(db, now: Date): Promise<{ stored; unchanged; failed }>`.
- `insertSnapshot` gains an optional `takenAt`.
- New `latestSnapshotPayload(db, investmentId, kind)` and `listDailyEligibleInvestmentIds(db)`.
- An existing `daily` row for the same `(investment_id, Warsaw day)` makes a re-run a no-op: the job is
  idempotent and a manual rerun is safe.

#### 2. Cron route + schedule

**File**: new `src/app/(payload)/api/cron/daily-snapshots/route.ts`, `vercel.json`, `src/lib/cache/tags.ts` (new `kosztorysSnapshots` tag), `src/app/(payload)/api/cron/cleanup/route.ts`

**Intent**: A thin route in the `fleet-reminders` / `cleanup` shape: `isAuthorizedCronRequest`, then
`captureDailySnapshots`, then JSON counts, with `maxDuration = 300`. When anything was stored, it bumps
`CACHE_TAGS.kosztorysSnapshots` with `revalidateTag(…, EXPIRE_NOW)`. That is the history list's tag
(Phase 4); `updateTag` throws in a Route Handler. `cron/cleanup` bumps the same tag after `gcSnapshots`
deletes anything.

**Contract**: The route is a new `vercel.json` entry `{"path":"/api/cron/daily-snapshots","schedule":"15 23 * * *"}`.
Its docblock states the attribution rule and the two accepted windows.

#### 3. Retention

**File**: `src/lib/db/snapshots.ts` (`gcSnapshots`)

**Intent**: The ceiling statement deletes `auto`/`manual` rows past 365 days, exactly as today. It
deletes `daily`/`named` rows only when their investment is `completed` and
`completed_at < now() − 365 days`. The bands stay keyed on `kind = 'auto'`. The returned breakdown adds
`investorExpired`.

**Contract**:

- `{ deleted, ceiling, daily, weekly, investorExpired }`.
- A `completed` row with a NULL `completed_at` cannot occur after the backfill. It must be treated as
  **keep**, which is fail-safe: never delete investor history on missing data.
- Update the policy comment.

### Success Criteria:

#### Automated Verification:

- DB spec `src/__tests__/lib/kosztorys/capture-daily-snapshots.test.ts`:
  - stores on the first run;
  - skips when unchanged;
  - stores after an edit;
  - carries `globalDiscount`;
  - skips szablon, completed and trashed investments;
  - a same-day re-run is a no-op;
  - `taken_at` falls on the previous Warsaw day for a winter `now` (00:15) and a summer `now` (01:15).
- DB spec extending `src/__tests__/lib/db/snapshots.test.ts`:
  - `daily`/`named` older than 365 days survive while the investment is active or planowana;
  - they are deleted a year after `completed_at`;
  - they survive with a NULL `completed_at`;
  - `auto`/`manual` behave exactly as before, with the existing cases unchanged.
- Route spec `src/__tests__/app/(payload)/api/cron/daily-snapshots/route.test.ts`: 401 without the
  secret, 200 with counts (cleanup route test pattern).

#### Manual Verification:

- Run the route locally with the cron secret, twice. The first run stores one row per active
  investment, and the second stores none.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Pure history library

### Overview

Everything the investor sees is derived from two payloads (a past version and the current one) by pure
functions, with no React and no DB.

### Changes Required:

#### 1. Snapshot → tree

**File**: new `src/lib/kosztorys/history/snapshot-to-tree.ts`

**Intent**: Rebuild a `KosztorysTreeT` from a `StoredSnapshotPayloadT`:

- group items by section and apply `itemWithColumnDefaults`;
- take settings from the payload, falling back to the live tree's for keys absent in old rows;
- use `globalDiscount` from the payload, or mark it unknown.

The result lets the past version render through the same `treeToRows` as the current one, so the
figures can't drift.

**Contract**: `snapshotToTree(payload, live: KosztorysTreeT): { tree: KosztorysTreeT; discount: HistoryDiscountT }`
where `HistoryDiscountT = { known: true; type; value } | { known: false }`.

#### 2. Version diff

**File**: new `src/lib/kosztorys/history/diff-versions.ts`

**Intent**: Match pozycje between the past and current trees:

- first by id;
- for items left unmatched on both sides, by `keyItems` + j.m. (design #14);
- stages by id, then by ordinal.

Emit: added (current-only), removed (past-only), and per matched pozycja the changed fields among
Przedmiar, Cena j.m., wartość netto, and Pomiar per etap. Plus a rabat change.

**Contract**:

- `diffVersions(past, current): VersionDiffT` holds `added: ItemRefT[]`, `removed: ItemRefT[]`,
  `changed: Map<currentItemId, FieldChangeT[]>`, `pastItemIdByCurrent` and `discount`.
- Money compares via `roundToCents` (L2029) and quantities within `QTY_TOLERANCE`, so float noise is
  not a change.
- Never feed a negative quantity into calc (L1191).

#### 3. Day selection + summary

**File**: new `src/lib/kosztorys/history/select-history-entries.ts`, `summarize-change.ts`

**Intent**:

- Given snapshot metas (id, kind, label, takenAt) and the investment's first `daily` takenAt, pick one
  entry per Warsaw day using the rule in Critical Implementation Details.
- Add every `named` row as its own entry.
- Drop a day whose payload equals the previous kept day's.
- Summarise each entry's change vs the previous listed entry, for example „3 pozycje dodane · Przedmiar
  zmieniony w 2 · Pomiar: +12 m² w etapie Płytki".

**Contract**: The selection is pure over metas and does not need payloads. Equality-dropping and the
summary need payloads, so they take `(prevPayload, payload)` pairs. Phase 4 decides which payloads to
load — and equality-dropping means it must load the payload of **every selected candidate day**, not
only the days that end up listed: whether a day is listed depends on its payload. Post-ship `daily`
rows are already deduplicated by the cron, so this cost is the pre-ship `auto` days only (at most
~120 daily + ~35 weekly survivors, ≤24 kB each), paid once per list-cache miss.

### Success Criteria:

#### Automated Verification:

- Unit specs under `src/__tests__/lib/kosztorys/history/`:
  - diff by id;
  - diff after an id remap (restore) reads as zero changes, not "all removed + all added";
  - Pomiar per etap changes;
  - added and removed pozycje;
  - rabat known → known, unknown → known, and no rabat change;
  - cents rounding does not flag a change;
  - `snapshotToTree` renders an old payload with no `globalDiscount` as unknown, never 0;
  - selection: pre-ship days come from `auto`, post-ship days only from `daily`, `named` is always an
    entry, an equal consecutive day is dropped, and Warsaw day boundaries around midnight and DST hold;
  - summary text for each change class.

#### Manual Verification:

- None. The phase is pure logic, covered by unit specs.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 4: Read path (history list + one version)

### Overview

Add two guarded entrances next to the existing preview reads, each scoped to the token's investment,
and cache them so immutable snapshot pairs are computed once.

### Changes Required:

#### 1. Token resolver

**File**: `src/lib/queries/preview-kosztorys.ts`

**Intent**: Extract the inlined token lookup into `resolveShareInvestmentId(token): Promise<number | null>`.
It stays uncached and keeps the trashed filter. `getPreviewKosztorysByToken` uses it, and so do both
history reads (L568).

**Contract**: The resolver is unexported beyond this module unless the history query file needs it. The
history reads live in the same file or in a sibling `preview-kosztorys-history.ts` that imports it.

#### 2. History queries

**File**: new `src/lib/queries/preview-kosztorys-history.ts`, `src/lib/db/snapshots.ts`

**Intent**:

- `listHistoryMetas(db, investmentId)` returns metas of kinds `auto`/`daily`/`named`, **without
  payload**, in a bounded per-day query: SQL keeps the newest `auto` and `daily` per Warsaw day plus all
  `named` rows, so the list never loads 10-min rows. It is scoped by `template_preset_id` like
  `listSnapshots`.
- `getHistoryPayloads(db, investmentId, ids)` loads payloads for the selected candidates (one per day
  plus the named rows — see Phase 3's contract on why every candidate), scoped to the investment
  (L1279).
- `resolveShareInvestmentId` reads **only** `kosztorys-shares`. A worker token
  (`kosztorys-worker-shares`) must never resolve here: the worker's document has no history.
- Entrances:
  - `getPreviewHistoryByToken(token)` and `ById(id)` return `HistoryEntryT[]`
    (id, day, kind, label, summary);
  - `getPreviewVersionByToken(token, snapshotId)` and `ById` return
    `{ tree, discount, diff } | null`.
  - `null` covers an unknown id, another investment's id, and a non-visible kind (`manual`). The page
    treats `null` as "render current", which fails closed and leaks nothing.

**Contract**:

- Summaries are cached with `unstable_cache` keyed by `(prevSnapshotId, snapshotId)`: immutable pairs,
  with no tag needed.
- The list is cached per investment, tagged `CACHE_TAGS.kosztorysSnapshots` (the new tag Phase 2 adds to
  `lib/cache/tags.ts`). It is bumped by the daily cron, by gc in `cron/cleanup`, and by
  `saveSnapshotAction` through `updateTag`, since that one is a server action.
- The version diff is **not** cached, because it depends on the live tree and is recomputed per request
  from the cached preview payload plus one snapshot row.
- The `ById` entrances keep the `requireAuth(MANAGEMENT_ROLES)` guard, mirroring
  `getPreviewKosztorysById`.

### Success Criteria:

#### Automated Verification:

- DB spec `src/__tests__/lib/queries/preview-kosztorys-history.test.ts`:
  - a token's version read of another investment's snapshot returns null;
  - a `manual` system row returns null;
  - a revoked or trashed token returns null;
  - the list never includes `manual` rows or more than one non-named row per day;
  - an old payload yields `discount.known === false`.

#### Manual Verification:

- None beyond Phase 5's.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 5: UI

### Overview

Add a „Historia zmian" button and dialog, and `?wersja=` rendering through `KosztorysEditorBody` on both
investor pages.

### Changes Required:

#### 1. Pages

**File**: `src/app/(share)/k/[token]/page.tsx`, `src/app/(share)/podglad-inwestora/[id]/page.tsx`

**Intent**: Read `searchParams.wersja` (the URL is the state, with no localStorage, L615/L637). When it
resolves, pass the past tree plus a `history` prop to `KosztorysEditorBody`. Always pass the history list
for the dialog. `key` the body on the version id, so the grid reseeds from the right tree.

#### 2. Editor body `history` prop

**File**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`, `kosztorys-synthetic-rows.tsx`, new `src/components/kosztorys/editor/history/*`

**Intent**: `history?: { diff; discount; takenAtLabel }`. When it is present:

- the grid shows the **past** tree, filtered by the **current** client-view settings (design #7);
- the data-driven empty-settlement-column rule is computed over the **past and current rows
  together**: a column with entries on either side is shown. Computed over the past rows alone, a
  version from before any work would hide every Pomiar column, and the flagship change
  („Pomiar: +12 m² w etapie Płytki", design #3) could never render. The current rows are
  `treeToRows(currentTree)` passed in with `history`;
- removed pozycje get a struck-through row class via `rowClassName`;
- changed cells render old → new in the `divergence-cell.tsx` two-value style via `withCellClass`;
- the totals panel and its toggle are hidden;
- a banner above the grid reads „Wersja z {dzień} — porównanie z bieżącą · Wróć do bieżącej". Under it
  go the rabat line (old → new, or „rabat nieznany") and the „Dodane od tego dnia: N pozycji" list.

**Contract**:

- Without `history` the body renders byte-identically to today, and the owner's editor is untouched.
- `history` and the „Historia zmian" trigger never appear with `worker`: the worker page passes
  neither, and the trigger is gated on `!worker` as well, so a future caller can't leak it.
- `client-empty` row rules and `PREVIEW_VISIBLE_COLUMNS` apply unchanged (L469/L498).

#### 3. History dialog

**File**: new `src/components/kosztorys/editor/history/history-dialog.tsx` (+ trigger in the preview header)

**Intent**: The list of entries, newest first: the day, or the label for named versions, plus the
summary. Each entry links to `?wersja=<id>`. With no entries it shows an empty state („Brak zmian do
pokazania").

### Success Criteria:

#### Automated Verification:

- DOM spec `src/__tests__/components/kosztorys/editor/history/history-view.test.tsx`:
  - a removed pozycja renders struck through;
  - a changed Przedmiar renders old → new;
  - an unknown rabat renders „rabat nieznany", not „0,00 zł";
  - the money panel is absent;
  - a column hidden in client view stays hidden;
  - a past version with no stage entries still shows an etap's Pomiar column when the current
    version has entries in it, rendering 0 → new;
  - without `history` there is no banner;
  - with `worker` there is no „Historia zmian" trigger.
- DOM spec for the dialog: the list order, a named entry showing its label, and the empty state.

#### Manual Verification:

- Open `/k/<token>`, then „Historia zmian", then a past day: the changes are visible and „Wróć do
  bieżącej" returns.
- The owner's „Podgląd dla inwestora" shows the identical screen.
- A hand-edited `?wersja=` of another investment's snapshot renders the current view.
- On a phone width (<768px) the dialog and banner are usable, with no horizontal page scroll.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 6: Docs, test-plan, archived-decision amendments

### Overview

Record the reversals and new risks so the next reader doesn't re-derive them.

### Changes Required:

#### 1. Living docs

**File**: `context/reference/kosztorys-editor-domain-notes.md` (or the snapshot section of the relevant foundation doc), `design.md`

**Intent**: Record:

- the kinds and their audiences, and the retention table (including "old rules for old rows");
- the reversal of S-06 "no diffing": diffing is for display only, and restore is unchanged;
- that the rabat is now captured for display;
- that snapshots now have a token-scoped public read.

Also amend `design.md` #11/#12 to "old rules for old rows": past `manual` rows are not milestones, and
past `auto` rows thin under today's bands.

#### 2. test-plan.md

**File**: `context/foundation/test-plan.md`

**Intent**: Via `/10x-test-plan`, add these risks:

- (a) a leak through the token or `?wersja=`;
- (b) the diff is wrong after an id remap;
- (c) retention deletes active history, or keeps it forever;
- (d) an old payload renders the rabat as 0.

Point each at the specs above.

#### 3. E2E owed

**Intent**: One spec: the investor opens the history via the link, opens a past day, and sees a
changed Przedmiar old → new. Author it at the review gate, or file it as a Linear `e2e-backlog` issue
in project Wykonczymy.

### Success Criteria:

#### Automated Verification:

- None. The phase is docs only.

#### Manual Verification:

- `design.md` #11/#12 match what shipped.

---

## Testing Strategy

### Unit Tests:

- The diff: id match, remap fallback, Pomiar per etap, added and removed pozycje, and the three rabat
  states (L751/L781).
- Selection and summary: pre-ship `auto` vs post-ship `daily`, named milestones, equal-day dropping,
  and Warsaw/DST boundaries.
- The completion-date hook transitions.

### Integration Tests:

- Nightly capture: stores on change, dedupes, scoped by status, idempotent, attributes the day.
- Retention: status-aware for `daily`/`named`, and `auto`/`manual` unchanged.
- The bridge: the rabat is in the payload and restore ignores it.
- Scoped reads: cross-investment, system kinds and revoked tokens all yield null.

### Manual Testing Steps:

1. Run the cron locally twice and check the row counts.
2. Edit Przedmiar and Pomiar in the editor, run the cron, then open the share link, the history, and
   yesterday's day.
3. Restore an old version in the editor, run the cron, and open the history: the restore does not read
   as "everything replaced".

## Performance Considerations

- The list never loads 10-min payloads (per-day SQL), and payloads load only for the entries shown.
- Per-entry summaries are cached per immutable pair.
- The version view does one diff over ≤1000 rows per request, O(n) with Map lookups.
- Nightly: ~65 investments, each one uncached tree build plus one ≤24 kB compare, run sequentially.

## Migration Notes

`20260928_3` is additive, so apply it to prod with `pnpm db:migrate:prod` **before** the push that ships
the code. The human does this. There is no payload migration (no schema bump), and past snapshot rows
are untouched.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit+DOM suite passes: `pnpm test`
- DB integration suite passes: `pnpm test:integration`
- Build succeeds: `pnpm build`

## References

- Design: `context/changes/2026-09-28-investor-change-history/design.md`
- Snapshot table + retention: `src/lib/db/snapshots.ts`, `context/archive/2026-09-02-snapshot-retention-thinning/`
- Original snapshots slice ("no diffing"): `context/archive/2026-07-10-kosztorys-snapshots/change.md:16`
- Preview reads: `src/lib/queries/preview-kosztorys.ts`
- Cron pattern: `src/app/(payload)/api/cron/cleanup/route.ts`, `src/__tests__/app/(payload)/api/cron/cleanup/route.test.ts`
- Item key: `src/lib/kosztorys/sheet-import/item-key.ts:47-63`
- Linear: EX-881

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data foundation

#### Automated

- [x] 1.1 Migration applies on 5433 and 5435 — 9ca4b64c
- [x] 1.2 stamp-completed-at hook unit spec passes — 9ca4b64c
- [x] 1.3 Round-trip spec: payload carries globalDiscount, restore leaves live rabat unchanged — 9ca4b64c
- [x] 1.4 saveSnapshotAction stores kind named — 9ca4b64c

### Phase 2: Nightly capture and status-aware retention

#### Automated

- [x] 2.1 capture-daily-snapshots DB spec passes — 0a9745fc
- [x] 2.2 gcSnapshots status-aware retention spec passes, existing cases unchanged — 0a9745fc
- [x] 2.3 daily-snapshots route spec passes — 0a9745fc

### Phase 3: Pure history library

#### Automated

- [x] 3.1 diff-versions unit specs pass
- [x] 3.2 snapshot-to-tree unit specs pass
- [x] 3.3 select-history-entries and summarize-change unit specs pass

### Phase 4: Read path (history list + one version)

#### Automated

- [ ] 4.1 preview-kosztorys-history DB spec passes

### Phase 5: UI

#### Automated

- [ ] 5.1 history-view DOM spec passes
- [ ] 5.2 history-dialog DOM spec passes
