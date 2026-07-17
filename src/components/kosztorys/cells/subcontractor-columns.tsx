import { Column, type CellProps } from 'react-datasheet-grid'
import { CellSelectMenu } from '@/components/kosztorys/cell-select-menu'
import { effectiveCoeff, viewPrice } from '@/lib/kosztorys/calc'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'
import { formatNet as fmt } from '@/lib/kosztorys/format'
import type {
  KosztorysV2RowT,
  SubcontractorOverrideTypeT,
  ViewPricingT,
} from '@/lib/kosztorys/types'
import type { ReactNode } from 'react'

// Where the subcontractor price comes from (a column in the subcontractor views). Labels name the
// SOURCE of the multiplier, not the arithmetic: auto and 'coeff' both compute clientPrice × n and
// differ only in whether n is inherited — labels describing the maths read as synonyms.
const SUB_MODE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'auto' },
  { value: 'coeff', label: 'własny mnożnik' },
  { value: 'amount', label: 'kwota stała' },
]

const OVERRIDE_FIELDS: Record<
  'w_tools' | 'own_tools',
  { type: keyof KosztorysV2RowT; value: keyof KosztorysV2RowT }
> = {
  w_tools: { type: 'wToolsOverrideType', value: 'wToolsOverrideValue' },
  own_tools: { type: 'ownToolsOverrideType', value: 'ownToolsOverrideValue' },
}

// The "Cena" column in the subcontractor view: shows either the derived price (greyed out when
// the override is null) or the entered override value. Entering a value while in the null state
// creates an 'amount' (flat) override; clearing it reverts to the derived price (null). The
// coeff vs amount mode is set by a separate "Tryb" column.
// Mnożnik and Cena j.m. both write the SAME pair of fields (overrideType + overrideValue) — the
// column you type into is what picks the type. That's why each is editable only in the modes where
// it carries the input: a mnożnik is meaningless under 'amount' (flat price), and a hand-typed price
// is meaningless under 'coeff'/auto (it's derived). The read-only side still renders its value so
// the row is legible in every mode.
export function subcontractorCoeffColumn(
  view: 'w_tools' | 'own_tools',
  titleNode: ReactNode,
): Column<KosztorysV2RowT> {
  const { type: typeField, value: valueField } = OVERRIDE_FIELDS[view]
  return {
    id: 'priceCoeff',
    title: titleNode,
    minWidth: 90,
    keepFocus: true,
    component: ({ rowData, setRowData }: CellProps<KosztorysV2RowT, unknown>) => {
      const type = rowData[typeField] as SubcontractorOverrideTypeT | null
      if (type === 'amount') {
        return <span className="text-muted-foreground block w-full px-2 text-left">—</span>
      }
      // auto: the row carries no multiplier of its own — show the inherited one as a placeholder
      // (section coeff, else the investment default), italic to read as "not set here".
      const inherited = type == null
      return (
        <input
          className={`size-full bg-transparent px-2 text-left text-sm outline-none ${inherited ? 'text-muted-foreground italic' : ''}`}
          value={inherited ? '' : String(rowData[valueField] ?? '')}
          placeholder={
            inherited ? String(effectiveCoeff(rowData as unknown as ViewPricingT, view)) : ''
          }
          inputMode="decimal"
          onChange={(e) => {
            const parsed = parseDecimalInput(e.target.value)
            if (parsed.kind === 'empty') {
              setRowData({ ...rowData, [typeField]: null, [valueField]: 0 })
              return
            }
            if (parsed.kind === 'invalid') return
            setRowData({ ...rowData, [typeField]: 'coeff', [valueField]: parsed.value })
          }}
        />
      )
    },
    copyValue: ({ rowData }) =>
      (rowData[typeField] as string | null) === 'amount'
        ? ''
        : String(effectiveCoeff(rowData as unknown as ViewPricingT, view)),
    deleteValue: ({ rowData }) => ({ ...rowData, [typeField]: null, [valueField]: 0 }),
  }
}

export function subcontractorPriceColumn(
  view: 'w_tools' | 'own_tools',
  titleNode: ReactNode,
): Column<KosztorysV2RowT> {
  const { type: typeField, value: valueField } = OVERRIDE_FIELDS[view]
  return {
    id: 'price',
    title: titleNode,
    minWidth: 90,
    keepFocus: true,
    component: ({ rowData, setRowData }: CellProps<KosztorysV2RowT, unknown>) => {
      const type = rowData[typeField] as SubcontractorOverrideTypeT | null
      const price = viewPrice(rowData as unknown as ViewPricingT, view)
      if (type !== 'amount') {
        return (
          <span className="text-muted-foreground block w-full px-2 text-left">{fmt(price)}</span>
        )
      }
      return (
        <input
          className="size-full bg-transparent px-2 text-left text-sm outline-none"
          value={String(rowData[valueField] ?? '')}
          inputMode="decimal"
          onChange={(e) => {
            const parsed = parseDecimalInput(e.target.value)
            if (parsed.kind === 'empty') {
              setRowData({ ...rowData, [typeField]: null, [valueField]: 0 })
              return
            }
            if (parsed.kind === 'invalid') return
            setRowData({ ...rowData, [typeField]: 'amount', [valueField]: parsed.value })
          }}
        />
      )
    },
    copyValue: ({ rowData }) => String(viewPrice(rowData as unknown as ViewPricingT, view)),
    deleteValue: ({ rowData }) => ({ ...rowData, [typeField]: null, [valueField]: 0 }),
  }
}

// Switching to auto zeroes the override value. Switching auto→coeff seeds the inherited multiplier
// as the starting point — leaving it at 0 would silently collapse the row's price to zero.
export function subcontractorModeColumn(
  view: 'w_tools' | 'own_tools',
  titleNode: ReactNode,
): Column<KosztorysV2RowT> {
  const { type: typeField, value: valueField } = OVERRIDE_FIELDS[view]
  return {
    id: 'priceMode',
    title: titleNode,
    // Fits the header label next to the sort icon — below this the title truncates.
    minWidth: 185,
    keepFocus: true,
    component: ({ rowData, setRowData }: CellProps<KosztorysV2RowT, unknown>) => (
      <CellSelectMenu
        value={(rowData[typeField] as string | null) ?? ''}
        options={SUB_MODE_OPTIONS}
        onChange={(value) => {
          const next = (value || null) as SubcontractorOverrideTypeT | null
          const seed =
            next === 'coeff' && !rowData[valueField]
              ? { [valueField]: effectiveCoeff(rowData as unknown as ViewPricingT, view) }
              : {}
          setRowData({
            ...rowData,
            [typeField]: next,
            ...(next === null ? { [valueField]: 0 } : seed),
          })
        }}
      />
    ),
    copyValue: ({ rowData }) => (rowData[typeField] as string | null) ?? '',
    deleteValue: ({ rowData }) => ({ ...rowData, [typeField]: null, [valueField]: 0 }),
  }
}
