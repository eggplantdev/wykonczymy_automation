'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { cn } from '@/lib/utils/cn'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPercent, formatPercentPrecise } from '@/lib/kosztorys/format'
import { MAX_CLIENT_SHARE, isOverCeiling } from '@/lib/kosztorys/subcontractor-price-guard'
import { FLAGGED_TONE, PLANE_LABELS, RATE_LABELS } from '@/lib/kosztorys/constants'
import { compareDescriptions } from '@/lib/kosztorys/work-catalogue/compare-descriptions'
import { CatalogueRowActions } from '@/components/work-catalogue/catalogue-row-actions'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

const col = createColumnHelper<WorkCatalogueItemT>()

const money = (value: number | null) =>
  value === null ? (
    <span className="text-muted-foreground text-sm">auto</span>
  ) : (
    <span className="tabular-nums">{formatPLN(value)}</span>
  )

// The share of „Cena j.m." a stawka eats — its own sortable column, because it is the figure the
// company's rule is written in. Over the ceiling it goes red and stops there: the katalog WARNS and
// never blocks. „Auto" has no share at all — the udział belongs to an inwestycja.
const shareOf = (rate: number | null, clientPrice: number) =>
  rate !== null && clientPrice > 0 ? rate / clientPrice : null

const share = (value: number | null, overCeiling: boolean) =>
  value === null ? (
    <span className="text-muted-foreground text-sm">—</span>
  ) : (
    <span className={cn('tabular-nums', overCeiling && FLAGGED_TONE)}>
      {formatPercentPrecise(value)}
    </span>
  )

// The break is written, not guessed from a width: these four labels are long enough to wrap on
// their own, and left to the browser they came out three lines deep.
const twoLines = (first: string, second: string) => () => (
  <span className="block">
    {first}
    <br />
    {second}
  </span>
)

const SHARE_TOOLTIP = `Udział stawki w cenie j.m. Powyżej ${formatPercent(MAX_CLIENT_SHARE)} na czerwono.`

// Lp. is the row's number in the KATALOG, pinned to alphabetical order over the whole catalogue, so
// it survives every sort and filter. `row.index` would slide under the row and name nothing.
const lpColumn = (ordinals: ReadonlyMap<number, number>) =>
  col.display({
    id: 'lp',
    header: 'Lp.',
    meta: { align: 'right' },
    cell: (info) => (
      <span className="text-muted-foreground text-sm tabular-nums">
        {ordinals.get(info.row.original.id)}
      </span>
    ),
  })

const descriptionColumn = col.accessor('description', {
  id: 'description',
  header: 'Opis pracy',
  sortingFn: (first, second) =>
    compareDescriptions(first.original.description, second.original.description),
  meta: { minWidth: 'min-w-112' },
  cell: (info) => <span className="block font-medium">{info.getValue()}</span>,
})

const categoryColumn = col.accessor((row) => row.category ?? '', {
  id: 'category',
  header: 'Kategoria',
  sortingFn: (first, second) =>
    compareDescriptions(first.original.category ?? '', second.original.category ?? ''),
  meta: { minWidth: 'min-w-50' },
  cell: (info) => <span className="text-muted-foreground text-sm">{info.getValue()}</span>,
})

const unitColumn = col.accessor('unit', {
  id: 'unit',
  header: 'j.m.',
  cell: (info) => <span className="text-muted-foreground text-sm">{info.getValue()}</span>,
})

const clientPriceColumn = col.accessor('clientPrice', {
  id: 'clientPrice',
  header: 'Cena j.m.',
  cell: (info) => money(info.getValue()),
})

const wToolsRateColumn = col.accessor('wToolsRate', {
  id: 'wToolsRate',
  header: twoLines('Stawka z narzędziami', '(podwykonawca)'),
  meta: { label: RATE_LABELS.w_tools },
  cell: (info) => money(info.getValue()),
})

// The plane is named ONCE per column. Spelled out twice — in the accessor and again in the red-rule
// argument — a copy-paste that updates only the first renders the w-tools verdict on the own-tools
// column, and both numbers look plausible. The ids stay literal so a search for `wToolsShare` finds
// the column the stored visibility map names.
const shareColumn = (field: 'wToolsRate' | 'ownToolsRate', id: string, tools: string) =>
  col.accessor((row) => shareOf(row[field], row.clientPrice), {
    id,
    header: twoLines('% ceny klienta', tools),
    meta: { tooltip: SHARE_TOOLTIP, label: `% ceny klienta ${tools}` },
    cell: (info) =>
      share(info.getValue(), isOverCeiling(info.row.original[field], info.row.original)),
  })

const wToolsShareColumn = shareColumn(
  'wToolsRate',
  'wToolsShare',
  PLANE_LABELS.w_tools.toLowerCase(),
)

const ownToolsRateColumn = col.accessor('ownToolsRate', {
  id: 'ownToolsRate',
  header: twoLines('Stawka bez narzędzi', '(pracownik)'),
  meta: { label: RATE_LABELS.own_tools },
  cell: (info) => money(info.getValue()),
})

const ownToolsShareColumn = shareColumn(
  'ownToolsRate',
  'ownToolsShare',
  PLANE_LABELS.own_tools.toLowerCase(),
)

// „Dodaj pracę z katalogu" reads the cennik to pick from it, never to tune it, so the udział columns
// and „Akcje" stay behind on /katalog-prac. They sit mid-order, hence assembled rather than sliced.
export const WORK_CATALOGUE_PICKER_COLUMNS = [
  descriptionColumn,
  categoryColumn,
  unitColumn,
  clientPriceColumn,
  wToolsRateColumn,
  ownToolsRateColumn,
]

export function getWorkCatalogueColumns({
  categorySuggestions,
  ordinals,
}: {
  categorySuggestions: readonly string[]
  ordinals: ReadonlyMap<number, number>
}) {
  return [
    lpColumn(ordinals),
    descriptionColumn,
    categoryColumn,
    unitColumn,
    clientPriceColumn,
    wToolsRateColumn,
    wToolsShareColumn,
    ownToolsRateColumn,
    ownToolsShareColumn,

    col.display({
      id: 'actions',
      header: 'Akcje',
      meta: { align: 'right' },
      cell: (info) => (
        <CatalogueRowActions item={info.row.original} categorySuggestions={categorySuggestions} />
      ),
    }),
  ]
}
