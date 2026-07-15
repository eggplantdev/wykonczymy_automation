---
change_id: ex-422-grid-remount-flicker
title: Stop the kosztorys grid remounting on every price-view toggle
status: preparing
created: 2026-07-15
updated: 2026-07-15
archived_at: null
branch: null
worktree: null
---

## Notes

Kill the whole-grid flicker on the kosztorys price-view toggle (Klient / Z narzędziami / Bez narzędzi).

Root cause: `view` sits in the DataSheetGrid `key` (src/components/kosztorys/kosztorys-editor-body.tsx:89), forcing a full remount. The justification comment ("dsg freezes columns at mount") is verified FALSE against dsg 4.11.6 source — useColumns memoizes on [gutterColumn, stickyRightColumn, columns] array identity, and buildV2Columns returns a fresh array every render, so columns already flow through without a remount.

Prerequisite: four inline `component:` arrows in src/lib/tables/kosztorys-v2-columns.tsx (lines 166, 218, 258, 344) mint a new component TYPE per render, remounting cells; hoist them to module-level components reading via columnData BEFORE removing the key.

Open question to resolve first: why the original "all 3 views showed the client price" bug happened (suspects: the inline arrows; React Compiler auto-memoizing the buildV2Columns call).

Linear: EX-422 (parent EX-435).
