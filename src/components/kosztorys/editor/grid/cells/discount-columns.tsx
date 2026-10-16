import { type ReactNode } from 'react'
import { Column, type CellProps } from 'react-datasheet-grid'
import { CellSelectMenu } from '@/components/ui/datasheet-grid/cell-select-menu'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { EditableCellInput } from '@/components/ui/datasheet-grid/editable-cell-input'
import { discountFromType, discountPolicy } from '@/lib/kosztorys/discount-edit'
import { DISCOUNT_TYPE_LABELS } from '@/lib/kosztorys/labels'
import { cellPaste } from '@/lib/kosztorys/cell-edit'
import { useCellDraft } from '@/components/kosztorys/editor/grid/cells/use-cell-draft'
import { decimalText } from '@/lib/utils/decimal-text'
import { toastMessage } from '@/lib/utils/toast'
import type { DiscountTypeT, KosztorysV2RowT } from '@/lib/kosztorys/types'

const DISCOUNT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Bez rabatu' },
  { value: 'percent', label: DISCOUNT_TYPE_LABELS.percent },
  { value: 'amount', label: DISCOUNT_TYPE_LABELS.amount },
]

function DiscountTypeCell({ rowData, setRowData, disabled }: CellProps<KosztorysV2RowT, unknown>) {
  if (disabled) {
    const label = DISCOUNT_OPTIONS.find((o) => o.value === (rowData.discountType ?? ''))?.label
    return <ReadOnlyCellText>{label}</ReadOnlyCellText>
  }
  return (
    <CellSelectMenu
      value={rowData.discountType ?? ''}
      options={DISCOUNT_OPTIONS}
      hideChevron
      onChange={(next) => {
        const switched = discountFromType(rowData, (next || null) as DiscountTypeT | null)
        if (switched.kind === 'blocked') return toastMessage(switched.message, 'error', 5000)
        setRowData({ ...rowData, ...switched.pair })
      }}
    />
  )
}

function switchedRow(rowData: KosztorysV2RowT, next: DiscountTypeT | null): KosztorysV2RowT {
  const switched = discountFromType(rowData, next)
  return switched.kind === 'blocked' ? rowData : { ...rowData, ...switched.pair }
}

function DiscountValueCell({
  rowData,
  setRowData,
  disabled,
  focus,
  stopEditing,
}: CellProps<KosztorysV2RowT, unknown>) {
  const edit = useCellDraft(rowData, setRowData, discountPolicy<KosztorysV2RowT>(), stopEditing)
  const text = decimalText(rowData.discountValue)
  if (disabled) return <ReadOnlyCellText>{text}</ReadOnlyCellText>
  return <EditableCellInput {...edit.inputProps} value={edit.draft ?? text} focus={focus} />
}

export function discountValueColumn(titleNode: ReactNode): Column<KosztorysV2RowT> {
  const policy = discountPolicy<KosztorysV2RowT>()
  return {
    id: 'discountValue',
    title: titleNode,
    component: DiscountValueCell,
    copyValue: ({ rowData }) => decimalText(rowData.discountValue),
    pasteValue: ({ rowData, value }) => cellPaste(value, rowData, policy),
    deleteValue: ({ rowData }) => policy.clear(rowData),
  }
}

export function discountTypeColumn(titleNode: ReactNode): Column<KosztorysV2RowT> {
  return {
    id: 'discountType',
    title: titleNode,
    component: DiscountTypeCell,
    keepFocus: true,
    copyValue: ({ rowData }) => rowData.discountType ?? '',
    // Through the pair transition, not by hand: a bare `discountType: null` would leave the value
    // standing as an orphan, which is the bug discount-edit.ts exists for.
    deleteValue: ({ rowData }) => switchedRow(rowData, null),
    pasteValue: ({ rowData, value }) =>
      switchedRow(rowData, value === 'percent' || value === 'amount' ? value : null),
  }
}
