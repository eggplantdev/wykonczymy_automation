'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { formatPercent, formatQty } from '@/lib/kosztorys/format'
import { formatPLN } from '@/lib/utils/format-currency'
import type { MaterialRowT } from '@/lib/materials/types'

const col = createColumnHelper<MaterialRowT>()

const money = (value: number) => (
  <span className="block text-right tabular-nums">{formatPLN(value)}</span>
)

export const MATERIALS_COLUMNS = [
  col.accessor('product', {
    header: 'Materiał',
    size: 320,
    meta: { minWidth: 'min-w-80', fill: true },
    cell: (info) => <span className="block font-medium">{info.getValue()}</span>,
  }),
  col.accessor('type', {
    header: 'Rodzaj',
    size: 180,
    cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
  }),
  col.accessor('pack', {
    header: 'Opakowanie',
    size: 120,
    enableSorting: false,
    cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
  }),
  col.accessor('qty', {
    header: 'Kupiono',
    size: 110,
    cell: (info) => (
      <span className="block text-right tabular-nums">{formatQty(info.getValue())}</span>
    ),
  }),
  col.accessor('investments', {
    header: 'Inwestycje',
    size: 120,
    cell: (info) => <span className="block text-right tabular-nums">{info.getValue()}</span>,
  }),
  col.accessor('avgNet', {
    header: 'Średnio netto',
    size: 140,
    cell: (info) => money(info.getValue()),
  }),
  col.accessor('minNet', { header: 'Min', size: 120, cell: (info) => money(info.getValue()) }),
  col.accessor('maxNet', { header: 'Max', size: 120, cell: (info) => money(info.getValue()) }),
  col.accessor('spread', {
    header: 'Rozrzut',
    size: 110,
    meta: { tooltip: 'O ile najdroższy zakup był droższy od najtańszego.' },
    cell: (info) => (
      <span className="block text-right tabular-nums">
        {info.getValue() > 0 ? formatPercent(info.getValue()) : ''}
      </span>
    ),
  }),
  col.accessor((row) => row.shopNames.join(', '), {
    id: 'shops',
    header: 'Sklepy',
    size: 220,
    enableSorting: false,
    cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
  }),
  col.accessor('cheapestShop', {
    header: 'Najtaniej',
    size: 140,
    cell: (info) => (info.row.original.shopNames.length > 1 ? info.getValue() : ''),
  }),
  col.accessor('gross', {
    header: 'Wydano brutto',
    size: 150,
    cell: (info) => money(info.getValue()),
  }),
  col.accessor('lastDate', {
    header: 'Ostatnio',
    size: 120,
    cell: (info) => <span className="text-muted-foreground tabular-nums">{info.getValue()}</span>,
  }),
]
