---
id: kosztorys-preset
title: Kosztorys presets (templates) — implementation plan (S-09)
status: planned
created: 2026-07-11
updated: 2026-07-11
---

# Kosztorys presets — implementation plan (S-09)

## Overview

Restore the legacy "start from a skeleton" behaviour the in-app editor dropped in S-01: a Manager+
user can **(a) seed** a new kosztorys from a reusable preset (sekcje + prace + prices, no job data)
and **(b) save** an existing kosztorys back as a named preset. A preset is structurally an S-06
snapshot payload with the job-specific fields stripped, applied to a **different** investment — so
this is a **fork-and-strip of the snapshot engine** plus one genuinely new axis: **global-scoped
storage** (every kosztorys table today is `investment`-required; presets are the first cross-investment
concept).

Autocomplete over preset prace (FR-006) is **carved out** into the deferred slice
`kosztorys-item-autocomplete` (Linear EX-434) and is **not built here**.

## Current State

- **Snapshot engine (the reuse target):** `serializeKosztorys(investmentId)`
  (`serialize-kosztorys.ts:8`) is a pure, investment-agnostic read → flat `SnapshotPayloadT`
  (`snapshot-format.ts:24`). `restoreKosztorys(payload, req, investmentId, payload)`
  (`restore-kosztorys.ts:25`) wipes the target tree then bulk-inserts sections → items → stages →
  progress, remapping child FKs by index; `investmentId` is already threaded into every insert row,
  so retargeting is trivial. It **also writes back** the investment's VAT/coeffs (`:100-109`).
- **Raw DAO pattern:** `src/lib/db/snapshots.ts` is the single owner of the raw `kosztorys_snapshots`
  table (no Payload collection — the `notification_reads` pattern). `insertSnapshot` uses
  `${JSON.stringify(payload)}::jsonb`; `listSnapshots` deliberately omits the jsonb payload.
- **Action + tx wrapper:** `restoreSnapshotAction` (`kosztorys-snapshots.ts:56`) owns the transaction
  (`beginTransaction` → fake `req` with `transactionID` + `context:{skipRevalidation:true}` → work →
  `commitTransaction`, rollback+rethrow on error), then revalidates the four tree tags + `investments`.
- **The gap S-09(a) fills:** `createInvestmentAction` (`investments.ts:33`) creates only the
  `investments` row — no kosztorys bootstrap. The editor builds sections/items on demand.
- **CTA templates:** `SaveSnapshotButton` (self-contained Dialog+input) and the "Wersje" drawer
  (`kosztorys-versions-drawer.tsx`, fetch-on-open list with per-row action) live in the toolbar right
  cluster (`kosztorys-editor-toolbar.tsx:99`).
- **Investment-create form:** `InvestmentForm` (`investment-form/investment-form.tsx`) →
  `InvestmentFormDataT` (`investment-schema.ts`) → `createInvestmentAction`. TanStack Form via
  `useManagedForm`; `toData` maps form values to the domain shape.

## Design decisions (owner-settled)

| Decision                        | Resolution                                                                                                                                                                                                      |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Storage (D9)**                | New **global** `kosztorys_presets` raw table (no Payload collection), one row per preset: `{id, name UNIQUE, schema_version, payload jsonb, created_at, created_by}`. jsonb payload mirrors the snapshot shape. |
| **Preset names**                | **Unique** — the name is the preset's identity. Save-as offers save-new (fails on duplicate name) and overwrite-existing-by-name.                                                                               |
| **Save-as retroactivity (D10)** | Editing/overwriting a preset **never** touches kosztorysy already seeded from it — spawned trees are frozen seed-defaults (the whole-slice snapshot rule). No FK from a kosztorys back to its source preset.    |
| **Seed target**                 | **Empty kosztorys only (v1)** — insert-only, no wipe. The CTA is offered only when the tree is empty; server re-checks emptiness and rejects otherwise.                                                         |
| **Investment settings on seed** | **Leave the target's VAT/coeffs untouched** — the preset applier drops the `restoreKosztorys` settings write-back (`:100-109`). A preset does not carry job pricing config onto a different investment.         |
| **Stages**                      | Seed stage **labels** (structure) with all `qtyDone` reset. A preset is only ever created via save-as from a real kosztorys, so "add a stage to a preset" = add it in a kosztorys, then overwrite the preset.   |
| **Seed entry points**           | **Both** — (1) a picker CTA in the empty editor, and (2) an optional preset select in the investment-create form, seeding via `createInvestmentAction`.                                                         |

## What we're NOT doing

- No autocomplete over preset prace (FR-006 → deferred `kosztorys-item-autocomplete`, EX-434).
- No seed-into-a-non-empty kosztorys (wipe-vs-merge deferred to a later slice).
- No retroactive propagation of preset edits to spawned kosztorysy.
- No preset editing UI, no preset delete/rename UI in v1 (overwrite-by-name is the only mutation
  path). Renaming/deleting presets can be a follow-up if the owner asks.
- No investment-settings (VAT/coeffs) transfer via preset.
- No GC/retention (presets are a small, deliberately-curated library, not ambient history).

## Contracts (new/forked surfaces)

- **`PresetPayloadT`** — reuse `SnapshotPayloadT` verbatim (same jsonb shape). The stripping happens
  at serialize time (job fields zeroed), not in the type. `settings` is retained in the payload for
  shape-parity but is **ignored on apply** (no write-back).
- **`serializeKosztorysAsPreset(investmentId): Promise<SnapshotPayloadT>`** — wraps
  `serializeKosztorys`, then maps items to zero `plannedQty`/`measuredQty`, null
  `discountType`/`discountValue`, `hiddenInExport:false`, null `note`; keeps stages' labels/ordinals
  but drops all `progress` (`[]`). Keeps sections + all structural item fields (`description`, `unit`,
  `clientPrice`, all `*Override*`, `costVariant`, `displayOrder`).
- **`applyPreset(payload, req, investmentId, payload)`** — fork of `restoreKosztorys` that (1) **does
  not wipe** (caller guarantees empty target), (2) **omits the settings write-back**, (3) inserts
  sections → items → stages (progress is already `[]`). Everything else (bulk insert, index-remap) is
  identical.
- **DAO `src/lib/db/presets.ts`** — `insertPreset` (save-new, relies on the UNIQUE constraint to 409),
  `upsertPresetByName` (overwrite), `getPreset(id)` → `{payload}`, `listPresets()` → meta WITHOUT the
  jsonb payload (`{id, name, createdAt, createdBy}`).
- **Actions (`src/lib/actions/kosztorys-presets.ts`):** `savePresetAction(investmentId, name, mode)`,
  `seedFromPresetAction(investmentId, presetId)`, `listPresetsAction()`.

---

## Phase 1 — Preset storage (global table + DAO)

**Goal:** a `kosztorys_presets` table and a DAO that reads/writes it. No UI, no serialize/apply yet.

1. **Hand-write migration** `src/migrations/<next>_add_kosztorys_presets.ts` — mirror
   `20260710_1_add_kosztorys_snapshots.ts`, but:
   - **No `investment_id`** (global).
   - `"name" varchar NOT NULL` + `CONSTRAINT ... UNIQUE ("name")`.
   - `"schema_version" integer NOT NULL`, `"payload" jsonb NOT NULL`.
   - `"created_at" timestamp(3) with time zone NOT NULL DEFAULT now()`.
   - `"created_by" integer REFERENCES "users"("id") ON DELETE SET NULL`.
   - `down`: `DROP TABLE IF EXISTS "kosztorys_presets";`.
   - Verify the file name's numeric prefix follows the latest migration; hand-write, don't
     `migrate:create` (stale-snapshot lesson).
2. **DAO** `src/lib/db/presets.ts` — `import 'server-only'`, `sql` from
   `@payloadcms/db-vercel-postgres`, `DbExecutorT` from `./get-db`. Functions:
   - `PresetMetaT = {id, name, createdAt, createdBy}`.
   - `insertPreset(db, {name, createdBy, payload})` → id (UNIQUE violation surfaces as a thrown PG
     error the action maps to a friendly "Preset o tej nazwie już istnieje").
   - `upsertPresetByName(db, {name, createdBy, payload})` → id (`ON CONFLICT (name) DO UPDATE`).
   - `getPreset(db, id)` → `{payload} | null`.
   - `listPresets(db)` → `PresetMetaT[]`, newest first, **without** the jsonb payload.
3. `pnpm generate:types` (gitignored output — never `git add`).

**Phase gate:** typecheck clean; migration applies against the local docker DB (5433) and `down`
reverses it. (Prod migration is owed only at push time — do not block the phase on it.)

**Tests:** none yet (storage exercised by Phase 4's real-DB specs).

---

## Phase 2 — Save-as-preset (serialize + action + CTA)

**Goal:** "Zapisz jako preset" turns the current kosztorys into a stored preset (new or overwrite).

1. **`serializeKosztorysAsPreset`** in `src/lib/kosztorys/serialize-preset.ts` (or export alongside
   `serialize-kosztorys.ts`) — wraps `serializeKosztorys`, strips job fields per the Contracts
   section. Pure, no writes.
2. **`savePresetAction(investmentId, name, mode: 'new' | 'overwrite')`** in
   `src/lib/actions/kosztorys-presets.ts` — `protectedAction` (MANAGEMENT_ROLES default), Zod-validate
   a trimmed non-empty name, serialize, then `insertPreset` (new) or `upsertPresetByName` (overwrite).
   On a UNIQUE violation in `'new'` mode return `{success:false, error:'Preset o tej nazwie już
istnieje'}`. No cache tags to revalidate (presets aren't read via a cached tree) — but revalidate a
   `['kosztorysPresets']` tag if the picker list is cached; otherwise the picker fetches on open (see
   Phase 3) and no tag is needed.
3. **CTA** — `SavePresetButton` in `src/components/kosztorys/save-preset-button.tsx`, mirroring
   `SaveSnapshotButton`: Dialog + name input + "nowy / nadpisz istniejący" choice. On overwrite, offer
   the existing preset names (fetched on dialog open via `listPresetsAction`). Place it in the toolbar
   right cluster next to `SaveSnapshotButton` (`kosztorys-editor-toolbar.tsx:99`).

**Phase gate:** save a preset from a seeded local kosztorys; confirm the row lands with job fields
zeroed (spot-check the jsonb); overwrite-by-name replaces in place; duplicate name in 'new' mode is
rejected with the Polish message.

**Tests:** deferred to Phase 4.

---

## Phase 3 — Seed-from-preset (applier + action + two entry points)

**Goal:** an empty kosztorys can be populated from a preset — from the empty editor AND at
investment-create time.

1. **`applyPreset`** in `src/lib/kosztorys/apply-preset.ts` — fork of `restoreKosztorys`: no wipe, no
   settings write-back, insert sections → items → stages (progress `[]`). Reuse the exact bulk-insert
   - index-remap blocks.
2. **`seedFromPresetAction(investmentId, presetId)`** — `protectedAction`, own the transaction like
   `restoreSnapshotAction` (`beginTransaction` → fake `req` with `skipRevalidation` → work → commit).
   **Empty-guard:** before applying, re-check the target tree is empty
   (`getKosztorysTree(investmentId)` has no sections, or a cheap `SELECT 1 FROM kosztorys_sections
WHERE investment_id = ...`); reject non-empty with `{success:false, error:'Kosztorys nie jest
pusty'}`. Load the preset via `getPreset` (resolve payload from the row, never trust a
   client-passed payload). Revalidate `['kosztorysSections','kosztorysItems','kosztorysStages',
'stageProgress']` (NOT `investments` — settings untouched).
3. **`listPresetsAction()`** — `protectedAction`, returns `PresetMetaT[]` (fetch-on-open, no cache).
4. **Entry point 1 — empty editor picker:** a "Seed z presetu" CTA shown only when the tree is empty
   (mirror the Wersje drawer's fetch-on-open list; per-row "Użyj"). On success the shell **remounts**
   the editor (dsg grid-reseed lesson — same as restore). Lives in the toolbar / empty-state.
5. **Entry point 2 — investment-create form:** add an optional `presetId` field to
   `investmentFormSchema` + `InvestmentFormValuesT` (a `<field.Select>` of `listPresets` options,
   default "— pusty kosztorys —"). Thread it through `toData` → `InvestmentFormDataT` →
   `createInvestmentAction`: after `payload.create` returns the new investment, if a `presetId` was
   chosen, `applyPreset` into it within the same action (fresh investment is trivially empty, so the
   guard is a formality). Load the preset options where the create dialog is rendered
   (`add-investment-dialog.tsx`).

**dsg + React-Compiler traps (lessons.md):** the empty-state picker must not fire the seed action
inside a `setState` updater; remount the grid via `key` on success; don't rely on `router.refresh()`
alone for the tree.

**Phase gate:** seed an empty kosztorys from the empty-editor CTA → tree appears, all qtyDone/measured
zero, VAT/coeffs on the target unchanged; create a new investment with a preset chosen → its kosztorys
is pre-populated; seeding a non-empty kosztorys is rejected.

**Tests:** deferred to Phase 4.

---

## Phase 4 — Tests

Real-DB Vitest specs (gated on `DB_POSTGRES_URL && PAYLOAD_SECRET`, mock `next/cache`), reusing the
`canonical()` id-free deep-equal harness from
`src/__tests__/lib/kosztorys/serialize-restore-roundtrip.test.ts`.

1. **serialize→apply roundtrip** — seed a source kosztorys, `serializeKosztorysAsPreset`, `applyPreset`
   into a fresh investment; assert the applied tree is id-free-deep-equal to the source **for
   structural fields only**, and that job fields are zeroed (all `measuredQty`/`plannedQty` 0, no
   discounts, no notes, no progress rows, `hiddenInExport` false). Assert the target's VAT/coeffs are
   **unchanged** by the apply.
2. **Empty-guard** — `seedFromPresetAction` against a non-empty investment returns the rejection and
   writes nothing (assert persisted state, not just the result).
3. **Unique-name / overwrite** — `savePresetAction` 'new' with a taken name is rejected; 'overwrite'
   replaces the payload in place (same row id, new content).
4. **Frozen-spawn** — seed investment A from preset P, then overwrite P from a different source; assert
   A's tree is unchanged (no retroactive propagation).

Assert **persisted/observable state**, never the action's return value alone (a success result can hide
a failed write — the test-driven-debugging rule).

---

## Migration & rollback

- One additive migration (Phase 1). Prod apply is deliberate and human-run (`pnpm db:migrate:prod`),
  owed only when the code ships — migrate prod **before** pushing the code that reads the table.
- Rollback = the migration's `down` (drops the table). No data in other tables references presets, so
  a drop is clean.

## Open risks & assumptions

- **UNIQUE-violation surfacing:** relying on the PG UNIQUE constraint for the "name taken" path means
  the action must catch the thrown constraint error and map it — verify the driver's error shape
  during Phase 2 (fall back to a pre-check `SELECT` if the shape is awkward).
- **Empty-guard race:** two concurrent seeds of the same fresh investment could both pass the guard.
  Single-editor app, low-stakes; the transaction + FK inserts would still both apply (duplicated
  tree). Acceptable for v1; note it, don't engineer around it.
- **Schema-version parity:** presets reuse `SNAPSHOT_SCHEMA_VERSION`. If the snapshot payload shape is
  ever bumped non-additively, presets stored under the old version rely on the same tolerant
  deserialization — confirm `applyPreset` inherits the "default missing / skip orphan" tolerance.

## Phasing summary

| Phase | Deliverable                                             | Gate                                                               |
| ----- | ------------------------------------------------------- | ------------------------------------------------------------------ |
| 1     | Global `kosztorys_presets` table + DAO                  | typecheck; migration up/down local                                 |
| 2     | Serialize-as-preset + `savePresetAction` + CTA          | preset row lands job-zeroed; overwrite + dup-name work             |
| 3     | `applyPreset` + seed action + two entry points          | empty seed works both ways; non-empty rejected; settings untouched |
| 4     | Real-DB roundtrip / guard / unique / frozen-spawn tests | green                                                              |

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. Manual verification is tracked in the manual-checks registry (`context/foundation/manual-checks.md`), not here.

### Phase 1: Preset storage (global table + DAO)

#### Automated

- [x] 1.1 Hand-write migration `<next>_add_kosztorys_presets.ts` (global, name UNIQUE, jsonb payload) — dfabd27
- [x] 1.2 DAO `src/lib/db/presets.ts` (insertPreset / upsertPresetByName / getPreset / listPresets) — dfabd27
- [x] 1.3 `pnpm generate:types` (gitignored — never `git add`) — dfabd27
- [x] 1.4 Typecheck clean; migration `up` applies to local docker DB (5433) and `down` reverses it — dfabd27

### Phase 2: Save-as-preset (serialize + action + CTA)

#### Automated

- [x] 2.1 `serializeKosztorysAsPreset` — wrap `serializeKosztorys`, strip job fields — 1cc0edd
- [x] 2.2 `savePresetAction(investmentId, name, mode)` in `src/lib/actions/kosztorys-presets.ts` — 1cc0edd
- [x] 2.3 `SavePresetButton` CTA in toolbar right cluster — 1cc0edd

### Phase 3: Seed-from-preset (applier + action + two entry points)

#### Automated

- [x] 3.1 `applyPreset` in `src/lib/kosztorys/apply-preset.ts` (no wipe, no settings write-back) — 9e842d3
- [x] 3.2 `seedFromPresetAction(investmentId, presetId)` with empty-guard + own transaction — 9e842d3
- [x] 3.3 `listPresetsAction()` — 9e842d3
- [x] 3.4 Entry point 1 — empty-editor picker CTA (remount grid via `key` on success) — 9e842d3
- [x] 3.5 Entry point 2 — optional `presetId` in investment-create form → `createInvestmentAction` — 9e842d3

### Phase 4: Tests

#### Automated

- [x] 4.1 serialize→apply roundtrip (structural equal; job fields zeroed; target VAT/coeffs unchanged) — 1146916
- [x] 4.2 Empty-guard rejection writes nothing (assert persisted state) — 1146916
- [x] 4.3 Unique-name / overwrite (dup rejected; overwrite replaces payload in place) — 1146916
- [x] 4.4 Frozen-spawn (overwrite preset never propagates to spawned tree) — 1146916
