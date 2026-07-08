import { stageValueForView, type PriceViewT } from '@/lib/kosztorys/calc'
import type {
  CostVariantT,
  ItemPatchT,
  KosztorysStageT,
  KosztorysTreeT,
  KosztorysV2RowT,
} from '@/types/kosztorys'

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

// Filtr toolbara: szukajka po opisie / sekcji / j.m. (parytet z v1). Pusty/whitespace → bez filtra.
export function filterRows(rows: KosztorysV2RowT[], query: string): KosztorysV2RowT[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter(
    (r) =>
      (r.description ?? '').toLowerCase().includes(q) ||
      r.sectionName.toLowerCase().includes(q) ||
      (r.unit ?? '').toLowerCase().includes(q),
  )
}

export type SortDirT = 'asc' | 'desc'

// Sort po wartości z accessora; stringi po locale (pl), liczby numerycznie. Zwraca nową tablicę.
export function sortRows(
  rows: KosztorysV2RowT[],
  getValue: (row: KosztorysV2RowT) => string | number,
  dir: SortDirT,
): KosztorysV2RowT[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const va = getValue(a)
    const vb = getValue(b)
    if (typeof va === 'string' || typeof vb === 'string') {
      return sign * String(va).localeCompare(String(vb), 'pl')
    }
    return sign * (va - vb)
  })
}

// Cofnij pole wiersza do wartości sprzed edycji (revert-on-error autosave), ale TYLKO
// jeśli od czasu nieudanego zapisu nic nowszego nie wpisano (current === attempted) —
// inaczej deptalibyśmy świeższą edycję użytkownika.
export function revertField(
  rows: KosztorysV2RowT[],
  id: number,
  field: keyof KosztorysV2RowT,
  prevValue: unknown,
  attempted: unknown,
): KosztorysV2RowT[] {
  return rows.map((r) => {
    if (r.id !== id || r[field] !== attempted) return r
    return { ...r, [field]: prevValue } as KosztorysV2RowT
  })
}

// Domyślne wartości nowej sekcji. MUSZĄ odpowiadać addSectionAction w
// src/lib/actions/kosztorys.ts — pliku 'use server' nie wolno eksportować stałych,
// więc trzymamy mirror tu i budujemy z niego optymistyczny wiersz (bez czekania na refresh).
export const NEW_SECTION_DEFAULTS = {
  name: 'Nowa sekcja',
  defaultCostVariant: 'w_tools',
} as const satisfies { name: string; defaultCostVariant: CostVariantT }

export type BlankRowInputT = {
  id: number
  displayOrder: number
  sectionId: number
  sectionName: string
  vatRate: number
  sectionDefaultCostVariant: CostVariantT
  sectionWToolsCoeff: number | null
  sectionOwnToolsCoeff: number | null
  globalWToolsCoeff: number
  globalOwnToolsCoeff: number
  stages: KosztorysStageT[]
}

// Pusty wiersz pozycji = serwerowe defaulty addItemAction + zdenormalizowane pola sekcji
// + stage_*=0. Budowany optymistycznie ze znanego id/displayOrder zwróconego przez akcję.
export function buildBlankRow(input: BlankRowInputT): KosztorysV2RowT {
  const stageFields: Record<string, number> = {}
  for (const st of input.stages) stageFields[stageKey(st.id)] = 0
  return {
    id: input.id,
    sectionId: input.sectionId,
    displayOrder: input.displayOrder,
    description: null,
    unit: null,
    plannedQty: 0,
    measuredQty: 0,
    discountType: null,
    discountValue: 0,
    clientPrice: 0,
    wToolsOverrideType: null,
    wToolsOverrideValue: 0,
    ownToolsOverrideType: null,
    ownToolsOverrideValue: 0,
    costVariant: null,
    hiddenInExport: false,
    note: null,
    sectionName: input.sectionName,
    vatRate: input.vatRate,
    sectionDefaultCostVariant: input.sectionDefaultCostVariant,
    sectionWToolsCoeff: input.sectionWToolsCoeff,
    sectionOwnToolsCoeff: input.sectionOwnToolsCoeff,
    globalWToolsCoeff: input.globalWToolsCoeff,
    globalOwnToolsCoeff: input.globalOwnToolsCoeff,
    ...stageFields,
  } as KosztorysV2RowT
}

export function applyAddItem(rows: KosztorysV2RowT[], row: KosztorysV2RowT): KosztorysV2RowT[] {
  return [...rows, row]
}

export function applyRemoveItem(rows: KosztorysV2RowT[], itemId: number): KosztorysV2RowT[] {
  return rows.filter((r) => r.id !== itemId)
}

// Liczba pozycji sekcji w pełnym zbiorze — strażnik inwariantu „sekcja ma ≥1 pozycję".
export function sectionItemCount(rows: KosztorysV2RowT[], sectionId: number): number {
  return rows.reduce((n, r) => (r.sectionId === sectionId ? n + 1 : n), 0)
}

// Przestaw pozycję w obrębie JEJ sekcji o jedno miejsce (▲/▼). Operuje na sekwencji
// wyświetlania pozycji tej samej sekcji (kolejność w `rows`), NIE na ciągłości bloku —
// dzięki temu toleruje pozycję dodaną przez applyAddItem na koniec `rows` (Slice 1).
// Zwraca tę samą referencję przy no-opie (brzeg bloku / nieznane id) — sygnał dla edytora,
// że nie ma czego zapisywać.
export function swapItemInSection(
  rows: KosztorysV2RowT[],
  itemId: number,
  dir: 'up' | 'down',
): KosztorysV2RowT[] {
  const target = rows.find((r) => r.id === itemId)
  if (!target) return rows
  // Indeksy w `rows` pozycji tej samej sekcji, w kolejności tablicy (= kolejności wyświetlania).
  const sameSection = rows
    .map((r, i) => ({ id: r.id, i }))
    .filter((_, idx) => rows[idx].sectionId === target.sectionId)
  const pos = sameSection.findIndex((x) => x.id === itemId)
  const targetPos = dir === 'up' ? pos - 1 : pos + 1
  if (targetPos < 0 || targetPos >= sameSection.length) return rows // brzeg bloku → no-op
  const a = sameSection[pos].i
  const b = sameSection[targetPos].i
  const next = [...rows]
  ;[next[a], next[b]] = [next[b], next[a]]
  return next
}

// Sąsiad pozycji w obrębie JEJ sekcji w kierunku ▲/▼ (ta sama sekwencja co swapItemInSection).
// `undefined` na brzegu bloku — sygnał no-op. Używane do swapu display_order dwóch wierszy.
export function sectionNeighbor(
  rows: KosztorysV2RowT[],
  itemId: number,
  dir: 'up' | 'down',
): KosztorysV2RowT | undefined {
  const target = rows.find((r) => r.id === itemId)
  if (!target) return undefined
  const sameSection = rows.filter((r) => r.sectionId === target.sectionId)
  const pos = sameSection.findIndex((r) => r.id === itemId)
  const neighborPos = dir === 'up' ? pos - 1 : pos + 1
  return sameSection[neighborPos]
}

// Σ wartości wykonanych etapów wiersza v2 wg ceny widoku (do kolumny „Pozostało").
export function rowDoneNetForView(
  row: KosztorysV2RowT,
  stages: KosztorysStageT[],
  view: PriceViewT,
): number {
  return stages.reduce(
    (sum, st) => sum + stageValueForView(row, row[stageKey(st.id)] ?? 0, view),
    0,
  )
}
