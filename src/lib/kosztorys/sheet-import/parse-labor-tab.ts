import { fold } from '@/lib/kosztorys/fold'
import { sectionColorForIndex } from '@/lib/kosztorys/section-colors'
import type {
  KosztorysItemT,
  KosztorysSectionT,
  KosztorysStageT,
  StageProgressT,
} from '@/lib/kosztorys/types'
import { HEADER_BLOCK_ROWS, isFooterLabel } from './columns'
import { referencesAnyColumn } from './formula-refs'
import { round6 } from '@/lib/utils/round'
import type { ResolvedLaborColumnsT } from './resolve-columns'
import { NO_AI_DRAFT } from '@/lib/kosztorys/constants'

export const NON_ITEM_MARKER = 'x'

export type ParsedItemT = Omit<
  KosztorysItemT,
  'wToolsOverrideValue' | 'ownToolsOverrideValue' | 'wToolsOverrideCoeff' | 'ownToolsOverrideCoeff'
>

export type ParsedLaborTabT = {
  sections: KosztorysSectionT[]
  items: ParsedItemT[]
  stages: KosztorysStageT[]
  progress: StageProgressT[]
  // -1 when the sheet has no footer.
  footerStart: number
  skippedBeforeFirstSection: number
  // 1-based sheet row per parsed praca, kept beside the items rather than on them: the items are
  // spread straight into inserts, and a stray field would ride along into the database.
  sheetRowByItemId: Map<number, number>
}

const text = (cell: unknown): string =>
  typeof cell === 'string' ? cell.trim() : cell == null ? '' : String(cell).trim()

const number = (cell: unknown): number =>
  round6(typeof cell === 'number' ? cell : Number(cell) || 0)

// Downwards, the footer is indistinguishable from a blank spacer row mid-sheet — both are marked and
// unnamed — and stopping at the first one truncates the import at that spacer, silently.
function findFooterStart(grid: unknown[][], columns: ResolvedLaborColumnsT['columns']): number {
  for (let rowIndex = grid.length - 1; rowIndex >= HEADER_BLOCK_ROWS; rowIndex--) {
    const row = grid[rowIndex] ?? []
    if (fold(row[columns.plannedQty]) === NON_ITEM_MARKER) continue
    const description = text(row[columns.description])
    if (description && !isFooterLabel(fold(description))) {
      return rowIndex + 1 < grid.length ? rowIndex + 1 : -1
    }
  }
  return -1
}

// „Pomiar z natury" means nothing only when the sheet computed it FROM the etapy: importing its
// value would store Σ etapów and later compare it against Σ etapów — a reconciliation that can never
// fire. `number()` is deliberately not used: its
// `|| 0` would turn an empty cell into a measurement of zero, flagging every row nobody has
// measured yet.
function readMeasuredQty(
  row: unknown[],
  formulaRow: unknown[],
  column: number | undefined,
  readsStages: (formula: unknown) => boolean,
): number | null {
  if (column === undefined) return null
  if (readsStages(formulaRow[column])) return null
  const cell = row[column]
  if (cell == null) return null
  if (typeof cell === 'string' && cell.trim() === '') return null
  const value = typeof cell === 'number' ? cell : Number(cell)
  return Number.isFinite(value) ? round6(value) : null
}

const DEFAULT_STAGE_CAPTION = /^(\d+) etap( ilosc)?$/

const isNamedStage = (caption: string): boolean =>
  caption !== '' && !DEFAULT_STAGE_CAPTION.test(fold(caption))

// delete etap
// column E and the run shrinks, so the fifth surviving column is the sheet's sixth etap.
const sheetStageNumber = (caption: string, column: number): number => {
  const match = DEFAULT_STAGE_CAPTION.exec(fold(caption))
  return match ? Number(match[1]) : column
}

export function parseLaborTab(
  grid: unknown[][],
  resolved: ResolvedLaborColumnsT,
  formulas: unknown[][],
): ParsedLaborTabT {
  const { columns, stages: stageColumns } = resolved
  const sections: KosztorysSectionT[] = []
  const items: ParsedItemT[] = []
  const progress: StageProgressT[] = []
  const sheetRowByItemId = new Map<number, number>()

  const sectionIdByName = new Map<string, number>()
  let currentSectionId: number | undefined
  let nextSectionId = 1
  let nextItemId = 1
  let skippedBeforeFirstSection = 0

  // Built from the resolved run, never from a literal „D:M": the narrow layouts put the etapy
  // somewhere else entirely, and a hardcoded range would read their Przedmiar as an etap.
  const readsStages = referencesAnyColumn(
    Array.from({ length: stageColumns.count }, (_, index) => stageColumns.firstColumn + index),
  )

  const footerStart = findFooterStart(grid, columns)
  const lastRow = footerStart < 0 ? grid.length : footerStart

  for (let rowIndex = HEADER_BLOCK_ROWS; rowIndex < lastRow; rowIndex++) {
    const row = grid[rowIndex] ?? []
    const description = text(row[columns.description])

    if (fold(row[columns.plannedQty]) === NON_ITEM_MARKER) {
      const name = (columns.section === undefined ? '' : text(row[columns.section])) || description
      if (!name || isFooterLabel(fold(name))) continue

      let sectionId = sectionIdByName.get(name)
      if (sectionId === undefined) {
        sectionId = nextSectionId++
        sectionIdByName.set(name, sectionId)
        sections.push({
          id: sectionId,
          name,
          displayOrder: sections.length,
          color: sectionColorForIndex(sections.length),
        })
      }
      currentSectionId = sectionId
      continue
    }

    if (!description) continue
    if (currentSectionId === undefined) {
      skippedBeforeFirstSection++
      continue
    }

    const discountFraction = columns.discount === undefined ? 0 : number(row[columns.discount])
    // A value of 1 or more
    // is a whole percent typed into the fraction column — 9 meaning 9%, not a 900% discount that
    // would price the praca deeply negative.
    const discountPercent =
      discountFraction >= 1 ? round6(discountFraction) : round6(discountFraction * 100)
    const itemId = nextItemId++
    sheetRowByItemId.set(itemId, rowIndex + 1)
    items.push({
      id: itemId,
      sectionId: currentSectionId,
      displayOrder: items.length,
      description,
      descriptionTranslations: {},
      unit: text(row[columns.unit]) || null,
      plannedQty: number(row[columns.plannedQty]),
      currentPlannedQty: null,
      discountType: discountFraction > 0 ? 'percent' : null,
      discountValue: discountFraction > 0 ? discountPercent : 0,
      clientPrice: number(row[columns.clientPrice]),
      sheetMeasuredQty: readMeasuredQty(
        row,
        formulas[rowIndex] ?? [],
        columns.measuredQty,
        readsStages,
      ),
      note: null,
      catalogueItemId: null,
      ...NO_AI_DRAFT,
      changeReason: null,
      reviewStatus: null,
    })

    for (let stage = 0; stage < stageColumns.count; stage++) {
      const qtyDone = number(row[stageColumns.firstColumn + stage])
      if (qtyDone !== 0) progress.push({ itemId, stageId: stage + 1, qtyDone })
    }
  }

  const captions = grid[HEADER_BLOCK_ROWS - 1] ?? []
  const caption = (column: number) => text(captions[stageColumns.firstColumn + column - 1])
  const usedColumns = new Set(progress.map((entry) => entry.stageId))

  const stageIdByColumn = new Map<number, number>()
  for (let column = 1; column <= stageColumns.count; column++) {
    if (usedColumns.has(column) || isNamedStage(caption(column)))
      stageIdByColumn.set(column, stageIdByColumn.size + 1)
  }

  const stages: KosztorysStageT[] = Array.from(stageIdByColumn, ([column, id]) => {
    const columnCaption = caption(column)
    return {
      id,
      ordinal: id,
      label: isNamedStage(columnCaption)
        ? columnCaption
        : `Etap ${sheetStageNumber(columnCaption, column)}`,
      plane: null,
      split: null,
      completed: false,
    }
  })

  return {
    sections,
    items,
    stages,
    progress: progress.map((entry) => ({
      ...entry,
      stageId: stageIdByColumn.get(entry.stageId) ?? entry.stageId,
    })),
    footerStart,
    skippedBeforeFirstSection,
    sheetRowByItemId,
  }
}
