---
change_id: remove-section-coeff
title: Remove per-section subcontractor coeff + explicit section sidebar buttons
status: implementing
created: 2026-07-24
updated: 2026-07-24
archived_at: null
branch: staging
worktree: null
---

## Notes

Remove the per-section subcontractor markup coeff (wToolsCoeff/ownToolsCoeff on kosztorys_sections) and all machinery to edit it (popover + CoeffField + server action + undo wiring + snapshot/preset carry + DB columns), collapsing effectiveCoeff to global-only; also replace the icon-only add-item/delete-section buttons in the sections sidebar with explicit labeled buttons „Dodaj pozycję do sekcji" and „Usuń sekcję".

Blast radius already scoped (2026-07-24):

- KEEP: global coeff (CoeffField shared with kosztorys-global-settings / summary-settings-bar / summary-expenses-tab), SnapshotSettingsT.{wTools,ownTools}Coeff (those are global).
- REMOVE (section tier): collection fields + drop-column migration (hand-written; kosztorys data throwaway pre-dogfooding → no backfill), types.ts (KosztorysSectionT + KosztorysV2RowT section fields, 2 sites), queries/kosztorys.ts mapping, v2-rows.ts denorm + SectionCoeffPatchT + inverseSectionCoeffPatch, calc.ts effectiveCoeff → global-only, insert-rows.ts / append-preset-sections.ts / serialize-preset.ts, actions/kosztorys.ts applySectionCoeff, use-kosztorys-editor.ts (sectionCoeffs / applySectionCoeff / handleSectionCoeffChange / undo wiring), kosztorys-section-summary.tsx popover, kosztorys-editor-body.tsx prop chain, use-undo-redo.ts.
- Tests to update/remove (~9): inverse-coeff-patch, serialize-restore-roundtrip, serialize-apply-preset, append-preset-sections, reconciliation, settlement, v2-rows, sort-value, snapshots + fixture kosztorys-bialostocka.json.
- Migration means a prod-migrate step is owed at ship time.
