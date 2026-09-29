import { escapeHtml } from '@/lib/utils/escape-html'
import { stageValueForView, type PriceViewT } from '@/lib/kosztorys/calc'
import { formatQty } from '@/lib/kosztorys/format'
import { rowTotalQtyDone } from '@/lib/kosztorys/settlement-rows'
import { stageLabel } from '@/lib/kosztorys/stage-label'
import { stageKey, stageValueNetKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT, KosztorysV2RowT, StageKeyT } from '@/lib/kosztorys/types'

// One printed column, for any audience: `cell` is handed the plane at render rather than closing over
// it, so the same factory serves the client's offer and a worker's stawka (`offer-columns.ts` /
// `worker-columns.ts`) without either deciding the other's price.
export type PrintColumnT = {
  key: string
  label: string
  colClass: string
  cellClass: string
  headerClass: string
  cell: (row: KosztorysV2RowT, view: PriceViewT, stages: KosztorysStageT[]) => string
}

export const DESCRIPTION_COLUMN: PrintColumnT = {
  key: 'description',
  label: 'Opis prac',
  colClass: '',
  cellClass: 'desc',
  headerClass: '',
  cell: (row) => escapeHtml(row.description ?? ''),
}

export const PLANNED_QTY_COLUMN: PrintColumnT = {
  key: 'plannedQty',
  label: 'Przedmiar',
  colClass: 'c-qty',
  cellClass: 'num',
  headerClass: 'num',
  cell: (row) => escapeHtml(formatQty(row.plannedQty)),
}

export const UNIT_COLUMN: PrintColumnT = {
  key: 'unit',
  label: 'Jednostka miary',
  colClass: 'c-unit',
  cellClass: 'unit',
  headerClass: 'num',
  cell: (row) => escapeHtml(row.unit ?? ''),
}

export const moneyColumn = (
  key: string,
  label: string,
  cell: PrintColumnT['cell'],
): PrintColumnT => ({
  key,
  label,
  colClass: 'c-value',
  cellClass: 'num value',
  headerClass: 'num',
  cell,
})

export const qtyColumn = (
  key: string,
  label: string,
  cell: PrintColumnT['cell'],
): PrintColumnT => ({
  key,
  label,
  colClass: 'c-qty',
  cellClass: 'num',
  headerClass: 'num',
  cell,
})

const perStage = (
  stages: KosztorysStageT[],
  column: (stage: KosztorysStageT, qtyKey: StageKeyT) => PrintColumnT,
) => stages.map((stage) => column(stage, stageKey(stage.id)))

export const stageQtyColumns = (stages: KosztorysStageT[]): PrintColumnT[] =>
  perStage(stages, (stage, qtyKey) => ({
    key: qtyKey,
    label: stageLabel(stage),
    colClass: 'c-stage-qty',
    cellClass: 'num',
    headerClass: 'num',
    cell: (row) => (row[qtyKey] ? formatQty(row[qtyKey]) : ''),
  }))

// The share a stage's value is priced by, as the grid computes it.
const stageNetValue = (
  row: KosztorysV2RowT,
  qtyKey: StageKeyT,
  view: PriceViewT,
  printStages: KosztorysStageT[],
) => stageValueForView(row, row[qtyKey] ?? 0, rowTotalQtyDone(row, printStages, view), view)

export const stageNetColumns = (
  stages: KosztorysStageT[],
  money: (amount: number) => string,
): PrintColumnT[] =>
  perStage(stages, (stage, qtyKey) =>
    moneyColumn(
      stageValueNetKey(stage.id),
      `${stageLabel(stage)} netto`,
      (row, view, printStages) =>
        row[qtyKey] ? money(stageNetValue(row, qtyKey, view, printStages)) : '',
    ),
  )
