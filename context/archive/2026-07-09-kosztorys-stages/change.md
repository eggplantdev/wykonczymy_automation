---
id: kosztorys-stages
title: Kosztorys stages (etapy) + per-item stage progress (S-04)
status: archived
archived_at: 2026-07-24T13:41:19Z
created: 2026-07-09
updated: 2026-07-24
---

# Kosztorys stages (etapy) — S-04

Add a variable number of stages (etapy) to a kosztorys and record per-item, per-stage
progress (ilość wykonana). Additive on top of the S-01 editor. The pure calc/row core for
stages was **already ported and unit-tested in S-01** (`stageValueForView`,
`rowRemainingForView`, `stageKey`, `diffRow.stageChanges`, `rowDoneNetForView`); this slice
builds the missing persistence (tables, collections, query, actions) and the editor UI
(dynamic stage columns + "Pozostało") around it.

- **Roadmap slice:** S-04, `context/foundation/roadmap.md`. PRD ref FR-004. Prereq: S-01.
- **Decision register:** `context/changes/kosztorys-mvp/change.md` (POC decisions on stages).
- **Owner calls (2026-07-09):** editable stage labels; include the computed "Pozostało"
  column; delete a stage via a control on its column header (blocked when any item has
  non-zero progress in it).

Plan: `plan.md`. Brief: `plan-brief.md`.
