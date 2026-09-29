'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { cn } from '@/lib/utils/cn'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPercentPrecise, formatRate } from '@/lib/kosztorys/format'
import { namesFigure } from '@/lib/kosztorys/calc'
import { clientShareCeilingLabel } from '@/lib/kosztorys/subcontractor-price-guard'
import { FLAGGED_TONE } from '@/components/kosztorys/flagged-tone'
import { PLANE_LABELS, PRICE_SOURCE_LABELS, RATE_LABELS } from '@/lib/kosztorys/labels'
import { compareDescriptions } from '@/lib/kosztorys/work-catalogue/compare-descriptions'
import {
  catalogueRateAmount,
  catalogueRateFor,
  catalogueSourceOf,
  isCatalogueOverCeiling,
} from '@/lib/kosztorys/work-catalogue/catalogue-rate'
import { CatalogueRowActions } from '@/components/work-catalogue/catalogue-row-actions'
import type { ToolPlaneT } from '@/lib/kosztorys/types'
import type { CatalogueUsageT, WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

const col = createColumnHelper<WorkCatalogueItemT>()

// The stawka as its źródło names it: a kwota, „auto", or the mnożnik — never the złotówka a mnożnik
// implies for THIS cennik's own cena j.m., which is a number nobody agreed to and which the wpis
// abandons the moment it lands in a rozpiska priced differently.
const rateCell = (entry: WorkCatalogueItemT, plane: ToolPlaneT) => {
  const rate = catalogueRateFor(entry, plane)
  const source = catalogueSourceOf(rate)
  return source === 'amount' ? (
    <span className="tabular-nums">{formatRate(rate.rate, source, rate.coeff)}</span>
  ) : (
    <span className="text-muted-foreground text-sm">{formatRate(null, source, rate.coeff)}</span>
  )
}

/**
 * The share of „Cena j.m." a stawka eats — its own sortable column, because it is the figure the
 * company's rule is written in. Over the ceiling it goes red and stops there: the katalog WARNS and
 * never blocks. „Auto" has no share at all — that udział belongs to an inwestycja.
 *
 * A mnożnik IS this share already, so it is read straight across rather than divided back out of a
 * kwota — dividing would print the same number one float residue worse.
 */
const shareOf = (entry: WorkCatalogueItemT, plane: ToolPlaneT) => {
  const { rate, coeff } = catalogueRateFor(entry, plane)
  if (namesFigure(coeff)) return coeff
  return namesFigure(rate) && entry.clientPrice > 0 ? rate / entry.clientPrice : null
}

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

// Per plane, because the próg is: the stawka bez narzędzi is the z-narzędziami one less 15%, so one
// tooltip on both columns would name a liczba only one of them turns red at.
const shareTooltip = (plane: ToolPlaneT) =>
  `Udział stawki w cenie j.m. Powyżej ${clientShareCeilingLabel(plane)} na czerwono.`

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

// The picker's `size`s: its virtualized list lays out fixed, so the narrow columns hold these widths
// and the opis fills the rest with its `size` as the floor. Their sum stays inside `dialog-xl` on a
// 1440 screen. /katalog-prac lays out from content and never reads them.
const descriptionColumnWith = (otherUnitIds: ReadonlySet<number>) =>
  col.accessor('description', {
    id: 'description',
    header: 'Opis pracy',
    size: 320,
    sortingFn: (first, second) =>
      compareDescriptions(first.original.description, second.original.description),
    meta: { minWidth: 'min-w-112', fill: true },
    cell: (info) => (
      <span className="block font-medium">
        {info.getValue()}
        {/* The same opis priced under another j.m. is not this wpis — it is a near-duplicate the
            cennik may want to merge, so it is named here and never counted into „Kosztorysy". */}
        {otherUnitIds.has(info.row.original.id) && (
          <span className="text-muted-foreground block text-xs font-normal">
            występuje z inną j.m.
          </span>
        )}
      </span>
    ),
  })

const descriptionColumn = descriptionColumnWith(new Set())

const categoryColumn = col.accessor((row) => row.category ?? '', {
  id: 'category',
  header: 'Kategoria',
  size: 180,
  sortingFn: (first, second) =>
    compareDescriptions(first.original.category ?? '', second.original.category ?? ''),
  meta: { minWidth: 'min-w-50' },
  cell: (info) => <span className="text-muted-foreground text-sm">{info.getValue()}</span>,
})

const unitColumn = col.accessor('unit', {
  id: 'unit',
  header: 'j.m.',
  size: 72,
  cell: (info) => <span className="text-muted-foreground text-sm">{info.getValue()}</span>,
})

const clientPriceColumn = col.accessor('clientPrice', {
  id: 'clientPrice',
  header: 'Cena j.m.',
  size: 120,
  cell: (info) => <span className="tabular-nums">{formatPLN(info.getValue())}</span>,
})

const wToolsRateColumn = col.accessor((row) => catalogueRateAmount(row, 'w_tools'), {
  id: 'wToolsRate',
  header: twoLines('Stawka z narzędziami', '(podwykonawca)'),
  size: 176,
  meta: { label: RATE_LABELS.w_tools },
  cell: (info) => rateCell(info.row.original, 'w_tools'),
})

// The plane is named ONCE per column. Spelled out twice — in the accessor and again in the red-rule
// argument — a copy-paste that updates only the first renders the w-tools verdict on the own-tools
// column, and both numbers look plausible. The ids stay literal so a search for `wToolsShare` finds
// the column the stored visibility map names.
const shareColumn = (plane: ToolPlaneT, id: string, tools: string) =>
  col.accessor((row) => shareOf(row, plane), {
    id,
    header: twoLines('% ceny klienta', tools),
    meta: { tooltip: shareTooltip(plane), label: `% ceny klienta ${tools}` },
    cell: (info) => share(info.getValue(), isCatalogueOverCeiling(info.row.original, plane)),
  })

// The źródło spelled out, beside the stawka that only IMPLIES it — „auto" and „×0,65" name their
// own źródło, but „8,50 zł" is a kwota stała that reads like any other number. Sortable and its own
// column so the cennik can be swept for „które prace jadą jeszcze na auto", which is the question
// behind every rate review.
const sourceColumn = (plane: ToolPlaneT, id: string, tools: string) =>
  col.accessor((row) => catalogueSourceOf(catalogueRateFor(row, plane)), {
    id,
    header: twoLines('Źródło', tools),
    meta: { label: `Źródło ${tools}` },
    cell: (info) => (
      <span className="text-muted-foreground text-sm">{PRICE_SOURCE_LABELS[info.getValue()]}</span>
    ),
  })

const wToolsSourceColumn = sourceColumn(
  'w_tools',
  'wToolsSource',
  PLANE_LABELS.w_tools.toLowerCase(),
)

const wToolsShareColumn = shareColumn('w_tools', 'wToolsShare', PLANE_LABELS.w_tools.toLowerCase())

const ownToolsRateColumn = col.accessor((row) => catalogueRateAmount(row, 'own_tools'), {
  id: 'ownToolsRate',
  header: twoLines('Stawka bez narzędzi', '(pracownik)'),
  size: 176,
  meta: { label: RATE_LABELS.own_tools },
  cell: (info) => rateCell(info.row.original, 'own_tools'),
})

const ownToolsSourceColumn = sourceColumn(
  'own_tools',
  'ownToolsSource',
  PLANE_LABELS.own_tools.toLowerCase(),
)

const ownToolsShareColumn = shareColumn(
  'own_tools',
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

// Counts distinct inwestycje, not pozycje: a praca repeated across five łazienki of one mieszkanie is
// still one kosztorys that would miss it. Absent until „Policz użycia" — a column of zeros before the
// count would read as „nothing uses anything".
const usageColumn = (usage: CatalogueUsageT) =>
  col.accessor((row) => usage.byId[row.id] ?? 0, {
    id: 'kosztorysCount',
    header: 'Kosztorysy',
    meta: { align: 'right' },
    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
  })

export function getWorkCatalogueColumns({
  categorySuggestions,
  ordinals,
  usage,
}: {
  categorySuggestions: readonly string[]
  ordinals: ReadonlyMap<number, number>
  usage: CatalogueUsageT | null
}) {
  return [
    lpColumn(ordinals),
    usage ? descriptionColumnWith(new Set(usage.otherUnitIds)) : descriptionColumn,
    categoryColumn,
    unitColumn,
    clientPriceColumn,
    wToolsSourceColumn,
    wToolsRateColumn,
    wToolsShareColumn,
    ownToolsSourceColumn,
    ownToolsRateColumn,
    ownToolsShareColumn,
    ...(usage ? [usageColumn(usage)] : []),

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
