'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { applyAddItem, catalogueSlicePlacement } from '@/lib/kosztorys/row-ops'
import { orderCommandsEnabled } from '@/lib/kosztorys/order-commands'
import { DEFAULT_SECTION_NAME } from '@/lib/kosztorys/constants'
import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import {
  insertSection,
  orderRowsBySections,
  patchSection,
  removeSection,
  restoreSection,
  treeToSections,
} from '@/lib/kosztorys/section-list'
import { sectionFooterRowId, sectionHeaderRowId } from '@/lib/kosztorys/synthetic-rows'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { settleAction } from '@/lib/utils/settle-action'
import type { EditorActionsT } from '@/components/kosztorys/editor/actions/editor-actions'
import type { EditorRowsT } from '@/components/kosztorys/editor/hooks/use-editor-rows'
import type { SortStateT } from '@/lib/kosztorys/row-view'
import type { useStaleTreeRecovery } from '@/components/kosztorys/editor/hooks/use-stale-tree-recovery'
import type { useDebouncedSave } from '@/components/kosztorys/editor/hooks/use-debounced-save'
import type { UndoRedoApiT } from '@/components/kosztorys/editor/hooks/use-undo-redo'
import type { UndoBurstsT } from '@/components/kosztorys/editor/hooks/use-undo-bursts'
import type { KosztorysTreeT, SectionMetaT } from '@/lib/kosztorys/types'

const SECTION_ROW_FIELDS = { sectionName: 'name', sectionColor: 'color' } as const
type SectionRowFieldT = keyof typeof SECTION_ROW_FIELDS

type SavesT = ReturnType<typeof useDebouncedSave>
type StaleTreeRecoveryT = ReturnType<typeof useStaleTreeRecovery>

type ArgsT = {
  investmentId: number
  tree: KosztorysTreeT
  stages: KosztorysTreeT['stages']
  globalDiscount: KosztorysTreeT['globalDiscount']
  sort: SortStateT
  editorRows: EditorRowsT
  actions: EditorActionsT
  save: SavesT['save']
  runNow: SavesT['runNow']
  reportFailure: StaleTreeRecoveryT['reportFailure']
  recoverStaleTree: StaleTreeRecoveryT['recoverStaleTree']
  flushUndoBuffer: UndoBurstsT['flushUndoBuffer']
  pruneByIds: UndoRedoApiT['pruneByIds']
  pushReversible: UndoBurstsT['pushReversible']
  dropHeight: (...keys: string[]) => void
  unfoldSection: (sectionId: number) => void
}

export function useSectionCrud({
  investmentId,
  tree,
  stages,
  globalDiscount,
  sort,
  editorRows,
  actions,
  save,
  runNow,
  reportFailure,
  recoverStaleTree,
  flushUndoBuffer,
  pruneByIds,
  pushReversible,
  dropHeight,
  unfoldSection,
}: ArgsT) {
  const { setRows, rowsRef, prevById, patchRows } = editorRows
  const [sections, setSections] = useState<SectionMetaT[]>(() => treeToSections(tree))
  const sectionsRef = useRef(sections)
  useLayoutEffect(() => {
    sectionsRef.current = sections
  })

  // Latest-value write alongside the state, so a second section gesture before the next render reads
  // the list the first one produced.
  function commitSections(next: SectionMetaT[]) {
    sectionsRef.current = next
    setSections(next)
  }

  function sectionMeta(sectionId: number) {
    return sectionsRef.current.find((section) => section.sectionId === sectionId)
  }

  function newSectionMeta(sectionId: number): SectionMetaT {
    return { sectionId, sectionName: DEFAULT_SECTION_NAME, sectionColor: null }
  }

  async function handleInsertSection(anchorSectionId: number, dir: 'above' | 'below') {
    if (!orderCommandsEnabled(sort)) return
    const res = await settleAction(() => actions.insertSection(anchorSectionId, dir))
    if (!res.success) return reportFailure(res.error, res.code)
    const meta = newSectionMeta(res.data.section.id)
    commitSections(insertSection(sectionsRef.current, meta, anchorSectionId, dir))
  }

  async function handleAddSection(): Promise<number | undefined> {
    const res = await settleAction(() => actions.addSection(investmentId))
    if (!res.success) {
      reportFailure(res.error, res.code)
      return undefined
    }
    const meta = newSectionMeta(res.data.section.id)
    commitSections(insertSection(sectionsRef.current, meta, null))
    return meta.sectionId
  }

  function rowsFromSections(treeSections: KosztorysTreeT['sections']) {
    const built = treeToRows({
      sections: treeSections,
      stages,
      progress: [],
      globalCoeffs: tree.globalCoeffs,
      vatRate: tree.vatRate,
      settlementMode: tree.settlementMode,
      materialsNetRate: tree.materialsNetRate,
      globalDiscount,
      revision: tree.revision,
    })
    for (const row of built) prevById.current.set(row.id, row)
    return built
  }

  function handleAppendedSections(slice: KosztorysTreeT['sections']) {
    const appended = rowsFromSections(slice)
    commitSections([...sectionsRef.current, ...treeToSections({ sections: slice })])
    setRows((rs) => [...rs, ...appended])
  }

  function handleAppendedCatalogueItems(
    slice: KosztorysTreeT['sections'][number],
    createdSection: boolean,
  ) {
    const placement = catalogueSlicePlacement(
      new Set(sectionsRef.current.map((section) => section.sectionId)),
      slice.id,
      createdSection,
    )
    if (placement === 'reseed') return recoverStaleTree()
    const appended = rowsFromSections([slice])
    if (placement === 'prepend') {
      const [meta] = treeToSections({ sections: [slice] })
      commitSections(insertSection(sectionsRef.current, meta, null))
      setRows((rs) => [...appended, ...rs])
    } else {
      const order = sectionsRef.current
      setRows((rs) => orderRowsBySections(appended.reduce(applyAddItem, rs), order))
    }
    unfoldSection(slice.id)
  }

  async function handleRemoveSection(sectionId: number) {
    const removed = rowsRef.current
      .filter((r) => r.sectionId === sectionId)
      .map((r) => prevById.current.get(r.id) ?? r)
    const meta = sectionMeta(sectionId)
    const { next, index } = removeSection(sectionsRef.current, sectionId)
    commitSections(next)
    setRows((rs) => rs.filter((r) => r.sectionId !== sectionId))
    dropHeight(
      ...removed.map((r) => String(r.id)),
      String(sectionHeaderRowId(sectionId)),
      String(sectionFooterRowId(sectionId)),
    )
    for (const [id, r] of prevById.current) {
      if (r.sectionId === sectionId) prevById.current.delete(id)
    }
    flushUndoBuffer()
    pruneByIds([sectionHeaderRowId(sectionId), ...removed.map((r) => r.id)])
    // collapsedSectionIds is left alone: an id whose section left the list folds nothing, and it keeps
    // the fold state if the server rejects and the section comes back.
    const res = await settleAction(() => actions.removeSection(sectionId))
    if (!res.success) {
      for (const r of removed) prevById.current.set(r.id, r)
      const restored = meta ? restoreSection(sectionsRef.current, meta, index) : sectionsRef.current
      commitSections(restored)
      setRows((rs) => orderRowsBySections([...rs, ...removed], restored))
      reportFailure(res.error, res.code)
    }
  }

  function applySectionField<K extends SectionRowFieldT>(
    sectionId: number,
    rowKey: K,
    value: SectionMetaT[K],
    { immediate = false }: { immediate?: boolean } = {},
  ) {
    commitSections(patchSection(sectionsRef.current, sectionId, { [rowKey]: value }))
    patchRows(
      (r) => r.sectionId === sectionId,
      (r) => ({ ...r, [rowKey]: value }),
    )
    const persist = immediate ? runNow : save
    persist(`section-field:${sectionId}:${rowKey}`, () =>
      actions.updateSectionField(sectionId, { [SECTION_ROW_FIELDS[rowKey]]: value }),
    )
  }

  function handleSetSectionField<K extends SectionRowFieldT>(
    sectionId: number,
    rowKey: K,
    value: SectionMetaT[K],
    undoLabel: string,
  ) {
    const before = sectionMeta(sectionId)?.[rowKey]
    if (before === undefined || before === value) return
    applySectionField(sectionId, rowKey, value)
    pushReversible(
      undoLabel,
      (v: SectionMetaT[K]) => applySectionField(sectionId, rowKey, v, { immediate: true }),
      before,
      value,
      [sectionHeaderRowId(sectionId)],
    )
  }

  function handleSetSectionColor(sectionId: number, color: SectionColorKeyT | null) {
    handleSetSectionField(sectionId, 'sectionColor', color, 'Zmiana koloru sekcji')
  }

  function handleRenameSection(sectionId: number, name: string) {
    handleSetSectionField(sectionId, 'sectionName', name, 'Zmiana nazwy sekcji')
  }

  return {
    sections,
    sectionsRef,
    sectionMeta,
    rowsFromSections,
    handleInsertSection,
    handleAddSection,
    handleAppendedSections,
    handleAppendedCatalogueItems,
    handleRemoveSection,
    handleSetSectionColor,
    handleRenameSection,
  }
}

export type SectionCrudT = ReturnType<typeof useSectionCrud>
