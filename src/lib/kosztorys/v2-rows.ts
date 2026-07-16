import { isGlobalDiscountActive } from '@/lib/kosztorys/calc'
import { STAGE_QTY_PREFIX, stageKey } from '@/lib/kosztorys/constants'
import type { ItemPatchT, KosztorysTreeT, KosztorysV2RowT, StageKeyT } from '@/types/kosztorys'

// Item fields editable in the grid (= the keys of ItemPatchT). The diff compares only these.
const ITEM_FIELDS = [
  'description',
  'unit',
  'plannedQty',
  'discountType',
  'discountValue',
  'clientPrice',
  'wToolsOverrideType',
  'wToolsOverrideValue',
  'ownToolsOverrideType',
  'ownToolsOverrideValue',
  'costVariant',
  'hiddenInExport',
  'note',
] as const satisfies readonly (keyof ItemPatchT)[]

export function treeToRows(tree: KosztorysTreeT): KosztorysV2RowT[] {
  const progressByItem = new Map<number, Record<number, number>>()
  for (const p of tree.progress) {
    const m = progressByItem.get(p.itemId) ?? {}
    m[p.stageId] = p.qtyDone
    progressByItem.set(p.itemId, m)
  }

  const globalDiscountActive = isGlobalDiscountActive(tree.globalDiscount)

  const rows: KosztorysV2RowT[] = []
  for (const section of tree.sections) {
    for (const item of section.items) {
      const qty = progressByItem.get(item.id) ?? {}
      const stageFields: Record<string, number> = {}
      for (const st of tree.stages) stageFields[stageKey(st.id)] = qty[st.id] ?? 0
      rows.push({
        ...item,
        sectionName: section.name,
        vatRate: tree.vatRate,
        globalDiscountActive,
        sectionDefaultCostVariant: section.defaultCostVariant,
        sectionWToolsCoeff: section.wToolsCoeff,
        sectionOwnToolsCoeff: section.ownToolsCoeff,
        globalWToolsCoeff: tree.globalCoeffs.wTools,
        globalOwnToolsCoeff: tree.globalCoeffs.ownTools,
        ...stageFields,
      } as KosztorysV2RowT)
    }
  }
  return rows
}

export type RowDiffT = {
  itemPatch?: ItemPatchT
  stageChanges?: { stageId: number; qty: number }[]
}

export function diffRow(prev: KosztorysV2RowT, next: KosztorysV2RowT): RowDiffT {
  const itemPatch: Record<string, unknown> = {}
  for (const f of ITEM_FIELDS) {
    if (prev[f] !== next[f]) itemPatch[f] = next[f]
  }

  const stageChanges: { stageId: number; qty: number }[] = []
  for (const k of Object.keys(next)) {
    if (!k.startsWith(STAGE_QTY_PREFIX)) continue
    const nextVal = next[k as StageKeyT]
    if (prev[k as StageKeyT] !== nextVal) {
      stageChanges.push({
        stageId: Number(k.slice(STAGE_QTY_PREFIX.length)),
        qty: Number(nextVal) || 0,
      })
    }
  }

  const diff: RowDiffT = {}
  if (Object.keys(itemPatch).length > 0) diff.itemPatch = itemPatch as ItemPatchT
  if (stageChanges.length > 0) diff.stageChanges = stageChanges
  return diff
}
