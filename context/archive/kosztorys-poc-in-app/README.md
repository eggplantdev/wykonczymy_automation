# Archived — Kosztorys in-app editor POC (raw working docs)

The POC-unique working docs from the **`poc-kosztorys-in-app`** branch, archived here on
2026-07-08 so they survive independently of that branch. The POC proved the in-app kosztorys
editor approach and settled the shape; these are its raw brainstorm/design/plan artifacts.

**Not the source of truth, and not a build spec.** They are POC-grade notes — decisions may
have since changed or been superseded. The reconciled, current decisions live in:

- `context/changes/kosztorys-mvp/change.md` — the durable MVP decision register (distilled from these).
- `context/foundation/roadmap.md` — the reconciled slice arc (F-01, S-01…S-15).

Kept as archive (not deleted) because they carry unique rationale the distilled docs don't
fully capture — the reasoning behind each POC decision, the sheet-inspection findings, and the
editor bake-off. Per the doc-lifecycle rule: durable rationale extracted → raw docs archived.

**Provenance:** verbatim copies from `poc-kosztorys-in-app` (original paths under
`docs/superpowers/…` and `context/changes/kosztorys-poc-in-app/…`). The pre-reorg `docs/`
duplicates of docs already living under `context/` on the mainline, and two unrelated handoffs
(settled/correction parity; the 06-11 transfery sheet-tab), were deliberately excluded.

## Contents

- `2026-06-19-kosztorys-poc-in-app-notes-BRAINDUMP.md` — the braindump (żywe notatki z brainstormu): goals, sheet inspection, schema, decisions.
- `2026-06-19-kosztorys-poc-in-app-design.md` / `kosztorys-poc-in-app-change.md` / `kosztorys-poc-in-app-plan.md` — the POC change identity + spec + plan.
- `2026-06-19-kosztorys-editor-grid-bakeoff-design.md` / `2026-06-19-kosztorys-editor-v2-datasheet-grid.md` — the editor grid bake-off (react-datasheet-grid won).
- `2026-06-20-kosztorys-*` — per-slice designs + plans (add/remove struktura, reorder, section subtotals, subcontractor pricing, CSV export, VAT-per-investment).
