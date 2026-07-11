---
id: kosztorys-preset
title: Kosztorys presets (templates) (S-09)
status: archived
created: 2026-07-11
updated: 2026-07-11
archived_at: 2026-07-11T12:31:00Z
branch: kosztorys-preset
---

# Kosztorys presets — S-09

Restore the legacy Sheets behaviour (a new sheet was copied from `KOSZTORYS_TEMPLATE_SHEET_ID`)
that the in-app editor dropped in S-01. A Manager+ user can:

- **(a) seed** a new kosztorys from a preset — a reusable skeleton of sekcje + prace + prices —
  instead of starting blank;
- **(b) save** an existing kosztorys back as a preset.

> **Autocomplete (FR-006) carved out (owner, 2026-07-11).** Adding items via autocomplete over
> preset prace was folded into S-09 on 2026-07-09, then carved back out into its own **deferred,
> unsequenced** slice `kosztorys-item-autocomplete` — highest-UI-risk / lowest-marginal-value part,
> strictly downstream of preset storage (this slice), so it ships later with zero rework. Not built
> here. See roadmap "Cut & folded slices".

- **Roadmap slice:** S-09, `context/foundation/roadmap.md`. PRD: owner request (2026-07-09);
  FR-006 (autocomplete) carved out to `kosztorys-item-autocomplete`. Prereq: S-01.
- **Structural cousin:** S-06 snapshots — a preset is a stripped-down serialized kosztorys tree.
  The `SnapshotPayloadT` / `serializeKosztorys` / bulk-insert-remap engine in `restoreKosztorys`
  are the reuse targets. See `research.md`.

## Settled shape (owner, 2026-07-09 — from roadmap)

- A preset = a kosztorys with job-specific fields stripped. **Keep:** sekcje (structure), prace
  (opis), J.m., prices, coefficients/overrides. **Reset:** przedmiar/pomiar, rabat, stage progress,
  note, hiddenInExport.
- **Snapshot pricing throughout** — preset prices are seed-defaults only, copied in then owned per
  item, never a live source of truth. Same rule as the catalogue snapshot rule.
- **Catalogue = autocomplete over the union of preset prace** (Model A). No separate catalogue
  table. _(Carved out 2026-07-11 → `kosztorys-item-autocomplete`; Model A still stands there.)_

## Owner decisions (2026-07-11)

- **D9 — preset scope + storage: named library, jsonb payload.** New `kosztorys_presets` table;
  each preset = one row `{id, name, schema_version, payload jsonb (stripped tree), created_at,
  created_by}`. Reuses the S-06 serialize/apply engine — a forked `restoreKosztorys` (no wipe,
  target `investmentId`, job fields already zeroed in the payload). Pick a preset by name at
  create-time / in the empty editor.
- **D10 — save-as: new OR overwrite existing; spawned kosztorysy frozen.** "Zapisz jako preset"
  offers both save-new and overwrite-an-existing-preset. Editing a preset **never** retroactively
  touches kosztorysy already seeded from it (frozen seed-defaults — the whole-slice snapshot rule).
- **Seed target: empty kosztorys only (v1).** The "seed from preset" CTA is offered **only when the
  tree is empty** (new investment / blank editor). Seed = insert-only; the wipe-vs-append question
  for a non-empty kosztorys is deferred to a later slice. No pre-apply snapshot needed in v1.

## Still open (plan-time detail, not schema-gating)

- **Stages in a preset:** seed stage *labels* (structure) with all `qtyDone` reset, or omit stages
  entirely? Recommend seed labels, reset progress.

_(Duplicate-prace-in-autocomplete moved to the carved-out `kosztorys-item-autocomplete` slice.)_

Research: `research.md`. Plan: `plan.md`. Brief: `plan-brief.md`.
