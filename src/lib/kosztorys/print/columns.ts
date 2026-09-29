import { escapeHtml } from '@/lib/utils/escape-html'
import type { ColumnValueT, ColumnValuesT } from '@/lib/kosztorys/columns/column-values'
import { formatQty } from '@/lib/kosztorys/format'
import { stageLabel } from '@/lib/kosztorys/stage-label'
import { stageKey, stageValueNetKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT, KosztorysV2RowT, StageKeyT } from '@/lib/kosztorys/types'

// One printed column, for any audience. A computed figure comes from the document's one
// `computedColumnValues`, built for its plane (`offer-columns.ts` / `worker-columns.ts`), so paper and
// grid cannot disagree on a number and no column can price at another plane than its neighbours.
export type PrintColumnT = {
  key: string
  label: string
  colClass: string
  cellClass: string
  headerClass: string
  cell: (row: KosztorysV2RowT) => string
}

export const formattedValue =
  (value: ColumnValueT, format: (n: number) => string) => (row: KosztorysV2RowT) => {
    const n = value(row)
    return n === null ? '' : format(n)
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

export const computedMoneyColumn =
  (valueOf: ColumnValuesT, format: (amount: number) => string) =>
  (key: string, label: string): PrintColumnT =>
    moneyColumn(key, label, formattedValue(valueOf(key), format))

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

export const computedQtyColumn =
  (valueOf: ColumnValuesT) =>
  (key: string, label: string): PrintColumnT =>
    qtyColumn(key, label, formattedValue(valueOf(key), formatQty))

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

export const stageNetColumns = (
  stages: KosztorysStageT[],
  valueOf: ColumnValuesT,
  money: (amount: number) => string,
): PrintColumnT[] =>
  perStage(stages, (stage, qtyKey) => {
    const key = stageValueNetKey(stage.id)
    const value = formattedValue(valueOf(key), money)
    return moneyColumn(key, `${stageLabel(stage)} netto`, (row) => (row[qtyKey] ? value(row) : ''))
  })
