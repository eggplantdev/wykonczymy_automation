---
change_id: pokaz-wszystkie-pozycje
title: Investor toggle in the client view that reveals pozycje hidden as empty
status: implemented
created: 2026-09-23
updated: 2026-09-23
archived_at: null
branch: zamrozone-brutto-wydatku-netto
worktree: null
---

## Notes

— investor-facing toggle in the client view (/k/[token] and „Podgląd dla inwestora") that lifts the owner's „Ukryj pozycje bez przedmiaru i bez wykonanej pracy" and shows the full list, so a curious investor can see the whole scope of works on offer. Plain useState (every visit opens curated), not tied to the Oferta/Rozliczenie variant, rendered only when hideEmptyRows is on. Print unaffected. Research findings: full tree already ships in the preview payload (preview-kosztorys.ts); gate is clientConditionIds in use-kosztorys-view-state.ts:45; toggle goes in the preview header in kosztorys-editor-body.tsx next to KosztorysTotalsPanelToggle; conditionCounts zeroed under preview (use-kosztorys-editor.ts:425) — client-empty needs exempting for a count label.
