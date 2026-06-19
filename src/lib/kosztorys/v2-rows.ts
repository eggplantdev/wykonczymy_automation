import type { ItemPatchT } from '@/lib/actions/kosztorys'
import type { KosztorysTreeT, KosztorysV2RowT } from '@/types/kosztorys'

export function stageKey(stageId: number): `stage_${number}` {
  return `stage_${stageId}`
}

// Pola pozycji edytowalne w siatce (= klucze ItemPatchT). Diff porównuje tylko je.
const ITEM_FIELDS = [
  'description',
  'unit',
  'plannedQty',
  'measuredQty',
  'discountType',
  'discountValue',
  'clientPrice',
  'subcontractorWToolsPrice',
  'subcontractorOwnToolsPrice',
  'costVariant',
  'vatRate',
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

  const rows: KosztorysV2RowT[] = []
  for (const section of tree.sections) {
    for (const item of section.items) {
      const qty = progressByItem.get(item.id) ?? {}
      const stageFields: Record<string, number> = {}
      for (const st of tree.stages) stageFields[stageKey(st.id)] = qty[st.id] ?? 0
      rows.push({
        ...item,
        sectionName: section.name,
        sectionVatRate: section.vatRate,
        sectionDefaultCostVariant: section.defaultCostVariant,
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
    if (!k.startsWith('stage_')) continue
    const nextVal = next[k as `stage_${number}`]
    if (prev[k as `stage_${number}`] !== nextVal) {
      stageChanges.push({ stageId: Number(k.slice('stage_'.length)), qty: Number(nextVal) || 0 })
    }
  }

  const diff: RowDiffT = {}
  if (Object.keys(itemPatch).length > 0) diff.itemPatch = itemPatch as ItemPatchT
  if (stageChanges.length > 0) diff.stageChanges = stageChanges
  return diff
}
