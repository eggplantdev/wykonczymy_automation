import { AI_REVIEW_COLUMN_IDS } from '@/lib/kosztorys/ai-review-columns'
import { priceSourceOf, resolvedCurrentPlannedQty, subcontractorPrice } from '@/lib/kosztorys/calc'
import { planeViewSuffix } from '@/lib/kosztorys/format'
import { ALL_PLANE_PRICE_KEYS, planePriceKeysFor } from '@/lib/kosztorys/plane-price-keys'
import type { RowConditionCtxT, RowConditionT } from '@/lib/kosztorys/row-conditions/types'
import { aiOffered, effectiveReviewStatus } from '@/lib/kosztorys/review-status'
import { measureDiscrepancy, rowTotalQtyDone } from '@/lib/kosztorys/settlement-rows'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import {
  isOwnRateOverCeiling,
  isSubcontractorPriceNegative,
  clientShareCeilingLabel,
} from '@/lib/kosztorys/subcontractor-price-guard'
import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import type { KosztorysV2RowT, ToolPlaneT } from '@/lib/kosztorys/types'
import { isTranslationStale, translationText } from '@/lib/i18n/description-translations'
import { LANGUAGE_SHORT, TRANSLATION_LANGUAGES } from '@/lib/i18n/languages'
import { translationColumnKey } from '@/lib/kosztorys/translation-column-keys'
import { REPORT_FIELD } from '@/lib/kosztorys/worker-report/report-field'

const qtyDone = (row: KosztorysV2RowT, ctx: RowConditionCtxT) =>
  ctx.qtyDoneByRowId?.get(row.id) ?? rowTotalQtyDone(row, ctx.stages, 'client')

// Both przedmiary count (EX-921): a pozycja added after the offer has ofertowy 0 and a priced
// aktualizacja, and the client's document still shows that figure.
const isEmptyOnBothAxes = (row: KosztorysV2RowT, ctx: RowConditionCtxT) =>
  !(row.plannedQty > 0) && !(resolvedCurrentPlannedQty(row) > 0) && !(qtyDone(row, ctx) > 0)

const hasPlannedOrAiQty = (row: KosztorysV2RowT) =>
  resolvedCurrentPlannedQty(row) > 0 || aiOffered(row)

const isPlannedQtyChanged = (row: KosztorysV2RowT) =>
  row.currentPlannedQty != null && row.currentPlannedQty !== (row.plannedQty || 0)

const hasItemDiscount = (row: KosztorysV2RowT) => row.discountType !== null && row.discountValue > 0

const priceColumnsFor = (plane: ToolPlaneT): readonly string[] => [
  'price',
  ...planePriceKeysFor(plane),
]

const ALL_PRICE_COLUMNS: readonly string[] = ['price', ...ALL_PLANE_PRICE_KEYS]

export const MEASURE_DIVERGED_CONDITION_ID = 'measure-diverged'

export const NO_PLANNED_OR_AI_QTY_CONDITION_ID = 'no-planned-or-ai-qty'
export const HAS_PLANNED_OR_AI_QTY_CONDITION_ID = 'has-planned-or-ai-qty'

export const CATALOGUE_DIVERGENCE_CONDITION_ID = 'catalogue-price-divergence'
export const CATALOGUE_MISSING_CONDITION_ID = 'catalogue-missing'

export const CLIENT_EMPTY_CONDITION_ID = 'client-empty'
export const REPORT_UNREPORTED_CONDITION_ID = 'report-unreported'

/** Where material is priced into the cena j.m., a percentage hands the crew a cut of material they never buy. */
function settledAtPercentRate(
  row: KosztorysV2RowT,
  ctx: RowConditionCtxT,
  plane: ToolPlaneT,
): boolean {
  if (!ctx.hasSettledMaterial) return false
  if (priceSourceOf(row, plane) === 'amount') return false
  return ctx.stages.some(
    (stage) =>
      (stage.plane === plane || stage.plane === null) && (row[stageKey(stage.id)] ?? 0) > 0,
  )
}

const percentRateProblemLabel = (plane: ToolPlaneT, count: number) =>
  `Stawki wykonawców liczone według formuły — ta inwestycja ma materiały wliczone w robociznę, ` +
  `więc stawki liczone ze współczynnika będą zawyżone; ustaw „Źródło ceny wykonawcy" na „kwota stała" ` +
  `(${count})`

const PLANE_SLUG = { w_tools: 'w-tools', own_tools: 'own-tools' } as const satisfies Record<
  ToolPlaneT,
  string
>

const planeSlug = (plane: ToolPlaneT) => PLANE_SLUG[plane]

const rateSourceConditions = (plane: ToolPlaneT): RowConditionT[] =>
  (
    [
      ['manual', 'amount', 'z kwoty stałej', 'Kwota stała'],
      ['coeff', 'coeff', 'z własnego mnożnika', 'Własny mnożnik'],
      ['formula', 'auto', '„auto"', 'Auto'],
    ] as const
  ).map(([idPrefix, source, labelTail, menuLabel]) => ({
    id: `${idPrefix}-rate-${planeSlug(plane)}`,
    label: `ze stawką wykonawcy ${labelTail}` + planeViewSuffix(plane),
    menuLabel,
    sectionLabel: null,
    kind: 'filter',
    filterGroup: `rate-source-${planeSlug(plane)}` as const,
    plane,
    revealsColumns: priceColumnsFor(plane),
    matches: (row) => priceSourceOf(row, plane) === source,
  }))

const rateCeilingConditions = (plane: ToolPlaneT): RowConditionT[] => {
  const ceiling = clientShareCeilingLabel(plane)
  const shared = {
    sectionLabel: null,
    kind: 'filter',
    filterGroup: `rate-ceiling-${planeSlug(plane)}` as const,
    plane,
    revealsColumns: priceColumnsFor(plane),
  } as const
  return [
    {
      ...shared,
      id: `own-rate-over-ceiling-${planeSlug(plane)}`,
      label: `z własną stawką ponad ${ceiling} ceny` + planeViewSuffix(plane),
      menuLabel: `Ponad ${ceiling} ceny`,
      matches: (row) => isOwnRateOverCeiling(row, plane),
    },
    {
      ...shared,
      id: `own-rate-within-ceiling-${planeSlug(plane)}`,
      label: `z własną stawką w granicy ${ceiling} ceny` + planeViewSuffix(plane),
      menuLabel: `W granicy ${ceiling} ceny`,
      matches: (row) => priceSourceOf(row, plane) !== 'auto' && !isOwnRateOverCeiling(row, plane),
    },
    {
      ...shared,
      id: `rate-ceiling-na-${planeSlug(plane)}`,
      label: 'ze stawką wykonawcy „auto" — udział nie dotyczy' + planeViewSuffix(plane),
      menuLabel: 'Nie dotyczy (auto)',
      matches: (row) => priceSourceOf(row, plane) === 'auto',
    },
  ]
}

/** Each predicate is written `!(x > 0)` rather than `x === 0`, so a null, an undefined and a negative
 * all read as „nie ma" — the grid writes null into a cleared cell. */
export const ROW_CONDITIONS: RowConditionT[] = [
  // Matching nothing outside „Przegląd AI" keeps the pair out of the menu there.
  {
    id: NO_PLANNED_OR_AI_QTY_CONDITION_ID,
    label: 'bez przedmiaru i bez AI przedmiaru',
    sectionLabel: null,
    kind: 'filter',
    filterGroup: 'ai-review',
    matches: (row, ctx) => (ctx.aiColumnsShown ?? false) && !hasPlannedOrAiQty(row),
  },
  {
    id: HAS_PLANNED_OR_AI_QTY_CONDITION_ID,
    label: 'z przedmiarem lub AI przedmiarem',
    sectionLabel: null,
    kind: 'filter',
    filterGroup: 'ai-review',
    matches: (row, ctx) => (ctx.aiColumnsShown ?? false) && hasPlannedOrAiQty(row),
  },
  // „Przedmiar" reads the Aktualizacja przedmiaru the client's document shows; whether it moved off
  // the offer is the next group's question.
  {
    id: 'no-planned-qty',
    label: 'bez przedmiaru',
    sectionLabel: 'Sekcje bez przedmiaru',
    kind: 'filter',
    filterGroup: 'planned',
    matches: (row) => !(resolvedCurrentPlannedQty(row) > 0),
  },
  {
    id: 'has-planned-qty',
    label: 'z przedmiarem',
    sectionLabel: 'Sekcje z przedmiarem',
    kind: 'filter',
    filterGroup: 'planned',
    matches: (row) => resolvedCurrentPlannedQty(row) > 0,
  },
  {
    id: 'planned-qty-as-offered',
    label: 'z przedmiarem jak w ofercie',
    menuLabel: 'Jak w ofercie',
    sectionLabel: null,
    kind: 'filter',
    filterGroup: 'planned-update',
    matches: (row) => !isPlannedQtyChanged(row),
  },
  {
    id: 'planned-qty-changed',
    label: 'z przedmiarem innym niż w ofercie',
    menuLabel: 'Inna niż w ofercie',
    sectionLabel: 'Sekcje z przedmiarem innym niż w ofercie',
    kind: 'filter',
    filterGroup: 'planned-update',
    revealsColumns: ['currentPlannedQty'],
    matches: isPlannedQtyChanged,
  },
  {
    id: 'no-measured-qty',
    label: 'bez wykonanej pracy',
    sectionLabel: 'Sekcje bez wykonanej pracy',
    kind: 'filter',
    filterGroup: 'measured',
    matches: (row, ctx) => !(qtyDone(row, ctx) > 0),
  },
  {
    id: 'has-measured-qty',
    label: 'z wykonaną pracą',
    sectionLabel: 'Sekcje z wykonaną pracą',
    kind: 'filter',
    filterGroup: 'measured',
    matches: (row, ctx) => qtyDone(row, ctx) > 0,
  },
  // Its own group: ticks in „Przedmiar" and „Wykonana praca" AND together, so only this pair reaches their union.
  {
    id: 'empty-both-axes',
    label: 'bez przedmiaru i bez wykonanej pracy',
    sectionLabel: null,
    kind: 'filter',
    filterGroup: 'filled',
    matches: isEmptyOnBothAxes,
  },
  {
    id: 'non-empty-both-axes',
    label: 'z przedmiarem lub wykonaną pracą',
    sectionLabel: null,
    kind: 'filter',
    filterGroup: 'filled',
    matches: (row, ctx) => !isEmptyOnBothAxes(row, ctx),
  },
  ...TOOL_PLANES.flatMap(rateSourceConditions),
  ...TOOL_PLANES.flatMap(rateCeilingConditions),
  {
    id: 'has-discount',
    label: 'z rabatem',
    sectionLabel: 'Sekcje z rabatem',
    kind: 'filter',
    filterGroup: 'discount',
    inertUnderGlobalDiscount: true,
    matches: (row) => !row.globalDiscountActive && hasItemDiscount(row),
  },
  {
    id: 'no-discount',
    label: 'bez rabatu',
    sectionLabel: 'Sekcje bez rabatu',
    kind: 'filter',
    filterGroup: 'discount',
    inertUnderGlobalDiscount: true,
    matches: (row) => !row.globalDiscountActive && !hasItemDiscount(row),
  },
  {
    id: CLIENT_EMPTY_CONDITION_ID,
    label: 'bez przedmiaru i bez wykonanej pracy',
    kind: 'client',
    // A row empty on BOTH axes adds zero to both totals, so hiding it moves no figure and needs no warning.
    matches: isEmptyOnBothAxes,
  },
  {
    id: REPORT_UNREPORTED_CONDITION_ID,
    label: 'bez zgłoszonej ilości',
    kind: 'client',
    // `!x` rather than `!(x > 0)`: a negative is a typo the send bar refuses, so it must stay in view.
    matches: (row) => !row[REPORT_FIELD],
  },
  {
    id: 'no-client-price-with-work',
    label: 'z wykonaną pracą bez ceny j.m.',
    kind: 'diagnostic',
    problemGroup: 'client-price',
    revealsColumns: [...ALL_PRICE_COLUMNS, 'stageQtySum'],
    matches: (row, ctx) => !(row.clientPrice > 0) && qtyDone(row, ctx) > 0,
  },
  {
    id: 'no-client-price',
    label: 'bez ceny j.m. i bez wykonanej pracy',
    kind: 'diagnostic',
    problemGroup: 'client-price',
    revealsColumns: ALL_PRICE_COLUMNS,
    matches: (row, ctx) => !(row.clientPrice > 0) && !(qtyDone(row, ctx) > 0),
  },
  {
    id: 'divergent-client-price',
    label: 'z inną ceną j.m. niż ta sama praca gdzie indziej',
    kind: 'diagnostic',
    problemGroup: 'client-price',
    problemLabel: (count) => `Te same prace z różnymi stawkami (${count})`,
    // Every price column, not „Cena j.m." alone: that column is built only on the „Inwestor" view
    // (kosztorys-v2-columns), so naming it by itself would reveal nothing on the two subcontractor views.
    revealsColumns: ALL_PRICE_COLUMNS,
    matches: (row, ctx) => ctx.divergentPriceRowIds.has(row.id),
  },
  {
    id: CATALOGUE_DIVERGENCE_CONDITION_ID,
    label: 'z innymi liczbami niż w katalogu prac',
    kind: 'diagnostic',
    problemGroup: 'catalogue',
    problemLabel: (count) => `Inne liczby niż w katalogu prac (${count})`,
    revealsColumns: ALL_PRICE_COLUMNS,
    matches: (row, ctx) => ctx.catalogueRowIds?.divergent.has(row.id) ?? false,
  },
  {
    id: CATALOGUE_MISSING_CONDITION_ID,
    label: 'spoza katalogu prac',
    kind: 'diagnostic',
    problemGroup: 'catalogue',
    problemLabel: (count) => `Brak w katalogu prac (${count})`,
    matches: (row, ctx) => ctx.catalogueRowIds?.missing.has(row.id) ?? false,
  },
  {
    id: MEASURE_DIVERGED_CONDITION_ID,
    label: 'z pomiarem do rozpisania na etapy',
    kind: 'diagnostic',
    problemGroup: 'scope-stages',
    matches: (row, ctx) => measureDiscrepancy(row, ctx.stages) != null,
  },
  {
    id: 'work-without-planned-qty',
    label: 'z wykonaną pracą bez przedmiaru',
    kind: 'diagnostic',
    problemGroup: 'scope-stages',
    revealsColumns: ['currentPlannedQty'],
    matches: (row, ctx) => !(resolvedCurrentPlannedQty(row) > 0) && qtyDone(row, ctx) > 0,
  },
  {
    id: 'ai-to-review',
    label: 'do sprawdzenia (szkic AI)',
    kind: 'diagnostic',
    problemGroup: 'ai-review',
    revealsColumns: AI_REVIEW_COLUMN_IDS,
    matches: (row, ctx) =>
      (ctx.hasAiDraft ?? false) && aiOffered(row) && !effectiveReviewStatus(row),
  },
  {
    id: 'ai-recheck',
    label: 'do ponownego sprawdzenia',
    kind: 'diagnostic',
    problemGroup: 'ai-review',
    revealsColumns: AI_REVIEW_COLUMN_IDS,
    matches: (row, ctx) => (ctx.hasAiDraft ?? false) && row.aiRecheck === true,
  },
  {
    id: 'ai-without-reason',
    label: 'zmienione bez powodu',
    kind: 'diagnostic',
    problemGroup: 'ai-review',
    revealsColumns: AI_REVIEW_COLUMN_IDS,
    matches: (row, ctx) => {
      if (!ctx.hasAiDraft) return false
      const status = effectiveReviewStatus(row)
      return status !== null && status !== 'accepted' && !(row.changeReason ?? '').trim()
    },
  },
  {
    id: 'negative-rate-w-tools',
    label: 'z ujemną stawką wykonawcy' + planeViewSuffix('w_tools'),
    kind: 'diagnostic',
    problemGroup: 'subcontractor-rate-w-tools',
    plane: 'w_tools',
    revealsColumns: priceColumnsFor('w_tools'),
    matches: (row) => isSubcontractorPriceNegative(row, 'w_tools'),
  },
  {
    id: 'negative-rate-own-tools',
    label: 'z ujemną stawką wykonawcy' + planeViewSuffix('own_tools'),
    kind: 'diagnostic',
    problemGroup: 'subcontractor-rate-own-tools',
    plane: 'own_tools',
    revealsColumns: priceColumnsFor('own_tools'),
    matches: (row) => isSubcontractorPriceNegative(row, 'own_tools'),
  },
  // On „auto" a zero is the global mnożnik speaking, and the mnożnik now says so itself, once, in its
  // own red field (`coeffWarning`).
  {
    id: 'no-w-tools-price',
    label: 'bez ceny wykonawcy' + planeViewSuffix('w_tools'),
    kind: 'diagnostic',
    problemGroup: 'subcontractor-rate-w-tools',
    plane: 'w_tools',
    revealsColumns: priceColumnsFor('w_tools'),
    matches: (row) =>
      row.clientPrice > 0 &&
      priceSourceOf(row, 'w_tools') !== 'auto' &&
      subcontractorPrice(row, 'w_tools') === 0,
  },
  {
    id: 'no-own-tools-price',
    label: 'bez ceny wykonawcy' + planeViewSuffix('own_tools'),
    kind: 'diagnostic',
    problemGroup: 'subcontractor-rate-own-tools',
    plane: 'own_tools',
    revealsColumns: priceColumnsFor('own_tools'),
    matches: (row) =>
      row.clientPrice > 0 &&
      priceSourceOf(row, 'own_tools') !== 'auto' &&
      subcontractorPrice(row, 'own_tools') === 0,
  },
  {
    id: 'material-percent-rate-w-tools',
    label: 'ze stawką wykonawcy od ceny z materiałem' + planeViewSuffix('w_tools'),
    kind: 'diagnostic',
    problemGroup: 'subcontractor-rate-w-tools',
    plane: 'w_tools',
    revealsColumns: priceColumnsFor('w_tools'),
    problemLabel: (count) => percentRateProblemLabel('w_tools', count),
    matches: (row, ctx) => settledAtPercentRate(row, ctx, 'w_tools'),
  },
  {
    id: 'material-percent-rate-own-tools',
    label: 'ze stawką wykonawcy od ceny z materiałem' + planeViewSuffix('own_tools'),
    kind: 'diagnostic',
    problemGroup: 'subcontractor-rate-own-tools',
    plane: 'own_tools',
    revealsColumns: priceColumnsFor('own_tools'),
    problemLabel: (count) => percentRateProblemLabel('own_tools', count),
    matches: (row, ctx) => settledAtPercentRate(row, ctx, 'own_tools'),
  },
  ...TRANSLATION_LANGUAGES.flatMap((language): RowConditionT[] => [
    {
      id: `missing-translation-${language}`,
      label: `bez tłumaczenia (${LANGUAGE_SHORT[language]})`,
      kind: 'diagnostic',
      problemGroup: 'translations',
      revealsColumns: [translationColumnKey(language)],
      matches: (row) =>
        (row.description ?? '').trim() !== '' &&
        translationText(row.descriptionTranslations, language) === '',
    },
    {
      id: `stale-translation-${language}`,
      label: `z nieaktualnym tłumaczeniem (${LANGUAGE_SHORT[language]})`,
      kind: 'diagnostic',
      problemGroup: 'translations',
      revealsColumns: [translationColumnKey(language)],
      matches: (row) => isTranslationStale(row.descriptionTranslations, language, row.description),
    },
  ]),
]
