import { isGlobalDiscountActive } from '@/lib/kosztorys/calc'
import { stageIdFromQtyKey, stageKey } from '@/lib/kosztorys/stage-keys'
import type { ItemPatchT, KosztorysTreeT, KosztorysV2RowT, StageKeyT } from '@/lib/kosztorys/types'

// Item fields editable in the grid (= the keys of ItemPatchT). The diff compares only these.
const ITEM_FIELDS = [
  'description',
  'unit',
  'plannedQty',
  'discountType',
  'discountValue',
  'clientPrice',
  'wToolsOverrideValue',
  'ownToolsOverrideValue',
  'wToolsOverrideCoeff',
  'ownToolsOverrideCoeff',
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
        sectionColor: section.color,
        vatRate: tree.vatRate,
        globalDiscountActive,
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
    const stageId = stageIdFromQtyKey(k)
    if (stageId === null) continue
    const nextVal = next[k as StageKeyT]
    if (prev[k as StageKeyT] !== nextVal) {
      stageChanges.push({ stageId, qty: Number(nextVal) || 0 })
    }
  }

  const diff: RowDiffT = {}
  if (Object.keys(itemPatch).length > 0) diff.itemPatch = itemPatch as ItemPatchT
  if (stageChanges.length > 0) diff.stageChanges = stageChanges
  return diff
}

type CoeffPatchT = { wToolsCoeff?: number; ownToolsCoeff?: number }

// Inverse of a global-coefficient panel edit: the before-values of ONLY the keys `patch` touched, so
// a Cmd+Z restores exactly those and leaves an untouched wTools/ownTools alone. `current` is any live
// row (coeffs are denormalized identically on all of them); undefined (empty grid) → the value is
// undefined, a no-op the caller's `!= null` patch guard skips.
export function inverseGlobalCoeffPatch(
  patch: CoeffPatchT,
  current: Pick<KosztorysV2RowT, 'globalWToolsCoeff' | 'globalOwnToolsCoeff'> | undefined,
): CoeffPatchT {
  const before: CoeffPatchT = {}
  if (patch.wToolsCoeff != null) before.wToolsCoeff = current?.globalWToolsCoeff
  if (patch.ownToolsCoeff != null) before.ownToolsCoeff = current?.globalOwnToolsCoeff
  return before
}
