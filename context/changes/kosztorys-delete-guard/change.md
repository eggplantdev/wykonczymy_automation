---
id: kosztorys-delete-guard
title: Kosztorys delete-guard for populated rows / sections / stages
status: implemented
created: 2026-07-10
updated: 2026-07-10
---

# Kosztorys delete-guard (S-08)

Hard-block deleting a kosztorys **item (row)** or **section** that still holds measured/executed
values, so a manager can't silently cascade-delete recorded work. Generalises the editor's existing
"delete a stage with recorded progress = blocked (clear first)" rule (`removeStageAction`,
`src/lib/actions/kosztorys.ts:286`) to the item- and section-delete paths, which have no guard today.

- **Roadmap slice:** S-08 `kosztorys-delete-guard` (`context/foundation/roadmap.md`). Carved out of
  the old `kosztorys-column-locking` slice on 2026-07-10; the role-based visibility half moved to
  S-10 `kosztorys-column-rbac`.
- **Column case is already covered:** a column = a stage (etap); `removeStageAction` already blocks
  deleting a stage with `stage_progress.qty_done <> 0`. No change needed there.
- **Predicate (owner, 2026-07-10):** "populated" = `measured_qty (pomiar) <> 0` OR any recorded
  `stage_progress.qty_done <> 0`. Plan-only rows (opis / przedmiar / price, never measured) delete
  freely.
- **Blocked UX (owner):** client pre-check blocks instantly with a toast (no optimistic remove);
  the server guard is the authority (defense in depth).

Plan: `plan.md` · Brief: `plan-brief.md`.
