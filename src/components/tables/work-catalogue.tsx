'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { translationText } from '@/lib/i18n/description-translations'
import { LANGUAGE_SHORT, TRANSLATION_LANGUAGES } from '@/lib/i18n/languages'
import {
  ALL_TRANSLATION_COLUMN_KEYS,
  translationColumnKey,
} from '@/lib/kosztorys/translation-column-keys'
import { cn } from '@/lib/utils/cn'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPercent, formatRate } from '@/lib/kosztorys/format'
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
import type {
  CatalogueUsageT,
  NearDuplicateKindT,
  NearDuplicateT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'

const col = createColumnHelper<WorkCatalogueItemT>()

const rateCell = (entry: WorkCatalogueItemT, plane: ToolPlaneT) => {
  const rate = catalogueRateFor(entry, plane)
  const source = catalogueSourceOf(rate)
  return source === 'amount' ? (
    <span className="tabular-nums">{formatRate(rate.rate, source, rate.coeff)}</span>
  ) : (
    <span className="text-muted-foreground">{formatRate(null, source, rate.coeff)}</span>
  )
}

const shareOf = (entry: WorkCatalogueItemT, plane: ToolPlaneT) => {
  const { rate, coeff } = catalogueRateFor(entry, plane)
  if (namesFigure(coeff)) return coeff
  return namesFigure(rate) && entry.clientPrice > 0 ? rate / entry.clientPrice : null
}

const share = (value: number | null, overCeiling: boolean) =>
  value === null ? (
    <span className="text-muted-foreground">—</span>
  ) : (
    <span className={cn('tabular-nums', overCeiling && FLAGGED_TONE)}>{formatPercent(value)}</span>
  )

const twoLines = (first: string, second: string) => () => (
  <span className="block">
    {first}
    <br />
    {second}
  </span>
)

const shareTooltip = (plane: ToolPlaneT) =>
  `Udział stawki w cenie j.m. Powyżej ${clientShareCeilingLabel(plane)} na czerwono.`

// it survives every sort and filter. `row.index` would slide under the row and name nothing.
const lpColumn = (ordinals: ReadonlyMap<number, number>) =>
  col.display({
    id: 'lp',
    header: 'Lp.',
    meta: { align: 'right' },
    cell: (info) => (
      <span className="text-muted-foreground tabular-nums">
        {ordinals.get(info.row.original.id)}
      </span>
    ),
  })

type DescriptionMarksT = {
  otherUnitIds: ReadonlySet<number>
  nearDuplicates: ReadonlyMap<number, readonly NearDuplicateT[]>
}

const NEAR_DUPLICATE_LEADS: Record<NearDuplicateKindT, string> = {
  same: 'prawie ten sam opis',
  oneWord: 'podobny opis',
}

const MARK_CLASS = 'text-muted-foreground block text-xs font-normal'

const descriptionColumnWith = ({ otherUnitIds, nearDuplicates }: DescriptionMarksT) =>
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
        {otherUnitIds.has(info.row.original.id) && (
          <span className={MARK_CLASS}>występuje z inną j.m.</span>
        )}
        {nearDuplicates.get(info.row.original.id)?.map(({ entry, kind }) => (
          <span key={entry.id} className={MARK_CLASS}>
            {NEAR_DUPLICATE_LEADS[kind]}: {entry.description} — {entry.unit} ·{' '}
            {formatPLN(entry.clientPrice)}
            {entry.category && ` · ${entry.category}`}
          </span>
        ))}
      </span>
    ),
  })

const descriptionColumn = descriptionColumnWith({
  otherUnitIds: new Set(),
  nearDuplicates: new Map(),
})

const translationColumns = TRANSLATION_LANGUAGES.map((language) =>
  col.accessor((row) => translationText(row.descriptionTranslations, language), {
    id: translationColumnKey(language),
    header: `Opis pracy (${LANGUAGE_SHORT[language]})`,
    size: 320,
    meta: { minWidth: 'min-w-112' },
    cell: (info) => <span className="block">{info.getValue()}</span>,
  }),
)

export const WORK_CATALOGUE_DEFAULT_VISIBILITY = Object.fromEntries(
  [...ALL_TRANSLATION_COLUMN_KEYS, 'workNote'].map((id) => [id, false]),
)

const categoryColumn = col.accessor((row) => row.category ?? '', {
  id: 'category',
  header: 'Kategoria',
  size: 180,
  sortingFn: (first, second) =>
    compareDescriptions(first.original.category ?? '', second.original.category ?? ''),
  meta: { minWidth: 'min-w-50' },
  cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
})

const unitColumn = col.accessor('unit', {
  id: 'unit',
  header: 'j.m.',
  size: 72,
  cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
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

const shareColumn = (plane: ToolPlaneT, id: string, tools: string) =>
  col.accessor((row) => shareOf(row, plane), {
    id,
    header: twoLines('% ceny klienta', tools),
    meta: { tooltip: shareTooltip(plane), label: `% ceny klienta ${tools}` },
    cell: (info) => share(info.getValue(), isCatalogueOverCeiling(info.row.original, plane)),
  })

const sourceColumn = (plane: ToolPlaneT, id: string, tools: string) =>
  col.accessor((row) => catalogueSourceOf(catalogueRateFor(row, plane)), {
    id,
    header: twoLines('Źródło', tools),
    meta: { label: `Źródło ${tools}` },
    cell: (info) => (
      <span className="text-muted-foreground">{PRICE_SOURCE_LABELS[info.getValue()]}</span>
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

export const WORK_CATALOGUE_PICKER_COLUMNS = [
  descriptionColumn,
  categoryColumn,
  unitColumn,
  clientPriceColumn,
  wToolsRateColumn,
  ownToolsRateColumn,
]

const workNoteColumn = col.accessor((row) => row.workNote ?? '', {
  id: 'workNote',
  header: 'Komentarz do pracy',
  size: 280,
  cell: (info) => <span className="text-muted-foreground block">{info.getValue()}</span>,
})

const countColumn = (id: string, header: string, tooltip: string, count: (id: number) => number) =>
  col.accessor((row) => count(row.id), {
    id,
    header,
    meta: { align: 'right', tooltip },
    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
  })

const KOSZTORYS_COUNT_TOOLTIP =
  'W ilu inwestycjach praca ma Przedmiar, aktualizację przedmiaru albo ilość w etapach. ' +
  'Liczone tylko z kosztorysów ' +
  'w aplikacji — stare arkusze Google się nie liczą, więc praca używana tylko tam ma tu 0.'

export function getWorkCatalogueColumns({
  categorySuggestions,
  ordinals,
  usage,
  nearDuplicates,
}: {
  categorySuggestions: readonly string[]
  ordinals: ReadonlyMap<number, number>
  usage: CatalogueUsageT
  nearDuplicates: DescriptionMarksT['nearDuplicates']
}) {
  return [
    lpColumn(ordinals),
    descriptionColumnWith({ otherUnitIds: new Set(usage.otherUnitIds), nearDuplicates }),
    ...translationColumns,
    categoryColumn,
    unitColumn,
    clientPriceColumn,
    wToolsSourceColumn,
    wToolsRateColumn,
    wToolsShareColumn,
    ownToolsSourceColumn,
    ownToolsRateColumn,
    ownToolsShareColumn,
    workNoteColumn,
    countColumn(
      'kosztorysCount',
      'Kosztorysy',
      KOSZTORYS_COUNT_TOOLTIP,
      (id) => usage.byId[id] ?? 0,
    ),
    countColumn(
      'templateCount',
      'Szablony',
      'W ilu szablonach stoi ta praca.',
      (id) => usage.templateNamesById[id]?.length ?? 0,
    ),

    col.display({
      id: 'actions',
      header: 'Akcje',
      meta: { align: 'right' },
      cell: (info) => (
        <CatalogueRowActions
          item={info.row.original}
          categorySuggestions={categorySuggestions}
          templateNames={usage.templateNamesById[info.row.original.id] ?? []}
        />
      ),
    }),
  ]
}
