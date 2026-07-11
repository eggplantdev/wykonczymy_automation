---
id: kosztorys-preset
title: Kosztorys presets (templates) — brief (S-09)
status: planned
created: 2026-07-11
updated: 2026-07-11
---

# Kosztorys presets — brief (S-09)

## The one-liner

Restore the legacy Sheets "copy a template to start" behaviour in-app: a Manager+ user can **save a
kosztorys as a reusable preset** and **seed a new kosztorys from one**. A preset is an S-06 snapshot
payload with the job data stripped, applied to a different investment — so it's a fork-and-strip of
the snapshot engine plus one new axis: **global (cross-investment) storage**.

Autocomplete over preset prace (FR-006) is **carved out** → deferred slice
`kosztorys-item-autocomplete` (EX-434). Not in this slice.

## Why this shape

- **~80% reuse.** `serializeKosztorys` and the bulk-insert/index-remap engine in `restoreKosztorys`
  already do the hard part. We fork them to (1) zero job fields at serialize, (2) skip the wipe, (3)
  skip the VAT/coeffs write-back onto the target.
- **Raw table + DAO, not a Payload collection** — matches `kosztorys_snapshots` / `notification_reads`.
  A preset = one row `{id, name UNIQUE, schema_version, payload jsonb, created_at, created_by}`.
- **Global scope is the new thing.** Every kosztorys table is `investment`-required today; the presets
  table is the first global concept, hence its own table and lifecycle (no GC — a curated library, not
  ambient history).

## Owner-settled decisions

- **Unique preset names** — name = identity; save-as does save-new or overwrite-by-name.
- **Frozen spawns** — overwriting a preset never touches kosztorysy already seeded from it (no back-FK).
- **Seed empty only (v1)** — insert-only; server re-checks emptiness and rejects a non-empty target.
- **Target settings untouched** — the applier drops the snapshot's VAT/coeffs write-back.
- **Stages** — seed labels, reset all progress.
- **Two entry points** — empty-editor picker CTA **and** an optional preset select in the
  investment-create form (seeds via `createInvestmentAction`).

## Four phases

1. **Storage** — hand-written migration for global `kosztorys_presets` + `src/lib/db/presets.ts` DAO.
2. **Save-as** — `serializeKosztorysAsPreset` (strip job fields) + `savePresetAction` (new/overwrite) +
   "Zapisz jako preset" CTA (mirrors `SaveSnapshotButton`).
3. **Seed** — `applyPreset` (no wipe, no settings write-back) + `seedFromPresetAction` (tx + empty
   guard) + `listPresetsAction` + the two entry points; editor remounts on apply.
4. **Tests** — real-DB serialize→apply roundtrip (structure equal, job fields zeroed, settings
   untouched), empty-guard rejection, unique-name/overwrite, frozen-spawn.

## Risks to watch

- UNIQUE-violation error shape from the PG driver (Phase 2) — fall back to a pre-check `SELECT` if
  catching it is awkward.
- Empty-guard is best-effort under concurrency — acceptable for a single-editor app; noted, not
  engineered around.

Full plan: `plan.md`. Research: `research.md`.
