'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { cn } from '@/lib/utils/cn'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPercentPrecise } from '@/lib/kosztorys/format'
import { MAX_CLIENT_SHARE } from '@/lib/kosztorys/subcontractor-price-guard'
import { compareDescriptions } from '@/lib/kosztorys/work-catalogue/compare-descriptions'
import { CatalogueRowActions } from '@/components/work-catalogue/catalogue-row-actions'
import type { SuspectT } from '@/lib/kosztorys/work-catalogue/suspects'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

const col = createColumnHelper<WorkCatalogueItemT>()

const money = (value: number | null) =>
  value === null ? (
    <span className="text-muted-foreground text-sm">auto</span>
  ) : (
    <span className="tabular-nums">{formatPLN(value)}</span>
  )

// The share of „Cena j.m." a stawka eats — its own column, sortable, because it is the figure the
// company's rule is written in. Over the ceiling it goes red and stops there: the katalog WARNS and
// never blocks, same stance as `appendCatalogueItems`. „Auto" has no share at all — the udział
// belongs to an inwestycja, not to the katalog.
const shareOf = (rate: number | null, clientPrice: number) =>
  rate !== null && clientPrice > 0 ? rate / clientPrice : null

const share = (value: number | null) =>
  value === null ? (
    <span className="text-muted-foreground text-sm">—</span>
  ) : (
    <span
      className={cn('tabular-nums', value > MAX_CLIENT_SHARE && 'text-destructive font-medium')}
    >
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

const SHARE_TOOLTIP = `Udział stawki w cenie j.m. Powyżej ${MAX_CLIENT_SHARE * 100}% na czerwono.`

// Lp. is the row's number in the KATALOG, not its position on screen: it is pinned to alphabetical
// order over the whole catalogue and survives every sort and every filter. A number that slid under
// the row whenever the table was re-sorted would name nothing — which is what both `row.index` and a
// position-in-the-rendered-model would give.
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

// TEMPORARY (EX-748 review): red = nie jest pracą, bursztyn = ma bliźniaka. The picker passes no
// map, so only /katalog-prac paints.
const SUSPECT_CLASS = {
  junk: 'text-destructive',
  duplicate: 'text-amber-600 dark:text-amber-400',
} as const satisfies Record<SuspectT['level'], string>

const makeDescriptionColumn = (suspects: ReadonlyMap<number, SuspectT>) =>
  col.accessor('description', {
    id: 'description',
    header: 'Opis pracy',
    sortingFn: (first, second) =>
      compareDescriptions(first.original.description, second.original.description),
    meta: { minWidth: 'min-w-96' },
    cell: (info) => {
      const suspect = suspects.get(info.row.original.id)
      return (
        <span className="block">
          <span className={cn('font-medium', suspect && SUSPECT_CLASS[suspect.level])}>
            {info.getValue()}
          </span>
          {/* Written out rather than left in a tooltip: the review reads down the column, and a
              reason that costs a hover per row would not be read at all. */}
          {suspect && (
            <span className={cn('block text-xs', SUSPECT_CLASS[suspect.level])}>
              {suspect.reason}
            </span>
          )}
        </span>
      )
    },
  })

const descriptionColumn = makeDescriptionColumn(new Map())

const categoryColumn = col.accessor((row) => row.category ?? '', {
  id: 'category',
  header: 'Kategoria',
  sortingFn: (first, second) =>
    compareDescriptions(first.original.category ?? '', second.original.category ?? ''),
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
  header: twoLines('Stawka z', 'narzędziami'),
  meta: { label: 'Stawka z narzędziami' },
  cell: (info) => money(info.getValue()),
})

const wToolsShareColumn = col.accessor((row) => shareOf(row.wToolsRate, row.clientPrice), {
  id: 'wToolsShare',
  header: twoLines('% ceny klienta', 'z narzędziami'),
  meta: { tooltip: SHARE_TOOLTIP, label: '% ceny klienta z narzędziami' },
  cell: (info) => share(info.getValue()),
})

const ownToolsRateColumn = col.accessor('ownToolsRate', {
  id: 'ownToolsRate',
  header: twoLines('Stawka bez', 'narzędzi'),
  meta: { label: 'Stawka bez narzędzi' },
  cell: (info) => money(info.getValue()),
})

const ownToolsShareColumn = col.accessor((row) => shareOf(row.ownToolsRate, row.clientPrice), {
  id: 'ownToolsShare',
  header: twoLines('% ceny klienta', 'bez narzędzi'),
  meta: { tooltip: SHARE_TOOLTIP, label: '% ceny klienta bez narzędzi' },
  cell: (info) => share(info.getValue()),
})

// „Dodaj pracę z katalogu" reads the cennik to pick from it, never to tune it — so the udział
// columns (the instrument for setting a stawka) and „Akcje" stay behind on /katalog-prac. They sit
// in the middle of the order, which is why the two lists are assembled rather than sliced.
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
  suspects,
}: {
  categorySuggestions: readonly string[]
  ordinals: ReadonlyMap<number, number>
  suspects: ReadonlyMap<number, SuspectT>
}) {
  return [
    lpColumn(ordinals),
    makeDescriptionColumn(suspects),
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
      cell: (info) => (
        <CatalogueRowActions item={info.row.original} categorySuggestions={categorySuggestions} />
      ),
    }),
  ]
}
