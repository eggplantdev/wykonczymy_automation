import { type ReactNode } from 'react'
import { Column, type CellProps } from 'react-datasheet-grid'
import { CellSelectMenu } from '@/components/kosztorys/cell-select-menu'
import { discountFromType, discountFromValue } from '@/lib/kosztorys/discount-edit'
import type { DiscountTypeT, KosztorysV2RowT } from '@/lib/kosztorys/types'

const DISCOUNT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Bez rabatu' },
  { value: 'percent', label: '%' },
  { value: 'amount', label: 'zł' },
]

// The type/value transitions live in discount-edit.ts — see there for why they're paired.
function DiscountTypeCell({ rowData, setRowData, disabled }: CellProps<KosztorysV2RowT, unknown>) {
  if (disabled) {
    const label = DISCOUNT_OPTIONS.find((o) => o.value === (rowData.discountType ?? ''))?.label
    return <span className="block size-full truncate px-2 text-sm">{label}</span>
  }
  return (
    <CellSelectMenu
      value={rowData.discountType ?? ''}
      options={DISCOUNT_OPTIONS}
      hideChevron
      onChange={(next) =>
        setRowData({
          ...rowData,
          ...discountFromType(rowData, (next || null) as DiscountTypeT | null),
        })
      }
    />
  )
}

// A hand-rolled input rather than floatColumn, because an edit here has to reach discountType too
// (discount-edit.ts), which a keyColumn can't do.
function DiscountValueCell({ rowData, setRowData, disabled }: CellProps<KosztorysV2RowT, unknown>) {
  if (disabled)
    return (
      <span className="block size-full truncate px-2 text-left text-sm">
        {String(rowData.discountValue ?? '')}
      </span>
    )
  return (
    <input
      className="size-full bg-transparent px-2 text-left text-sm outline-none"
      value={String(rowData.discountValue ?? '')}
      inputMode="decimal"
      onChange={(e) => {
        const next = discountFromValue(rowData, e.target.value)
        if (next) setRowData({ ...rowData, ...next })
      }}
    />
  )
}

export function discountValueColumn(titleNode: ReactNode): Column<KosztorysV2RowT> {
  return {
    id: 'discountValue',
    title: titleNode,
    minWidth: 80,
    keepFocus: true,
    component: DiscountValueCell,
    copyValue: ({ rowData }) => String(rowData.discountValue ?? ''),
    deleteValue: ({ rowData }) => ({ ...rowData, discountType: null, discountValue: 0 }),
  }
}

export function discountTypeColumn(titleNode: ReactNode): Column<KosztorysV2RowT> {
  return {
    id: 'discountType',
    title: titleNode,
    minWidth: 110,
    component: DiscountTypeCell,
    keepFocus: true,
    copyValue: ({ rowData }) => rowData.discountType ?? '',
    deleteValue: ({ rowData }) => ({ ...rowData, discountType: null }),
    pasteValue: ({ rowData, value }) => ({
      ...rowData,
      discountType: (value === 'percent' || value === 'amount'
        ? value
        : null) as DiscountTypeT | null,
    }),
  }
}
