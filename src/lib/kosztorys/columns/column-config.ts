import { AI_REVIEW_COLUMN_IDS } from '@/lib/kosztorys/ai-review-columns'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import { PLANE_LABEL_KEYS, PLANE_LABELS } from '@/lib/kosztorys/labels'
import { planePriceKeyParts } from '@/lib/kosztorys/plane-price-keys'
import { pl } from '@/lib/i18n/dictionaries/pl'
import { LANGUAGE_SHORT } from '@/lib/i18n/languages'
import { POLISH_GRID, type MessageKeyT, type TranslatorT } from '@/lib/i18n/translations'
import {
  ALL_TRANSLATION_COLUMN_KEYS,
  translationColumnLanguage,
} from '@/lib/kosztorys/translation-column-keys'
import {
  STAGE_VALUE_GROSS_COLUMN_GROUP,
  STAGE_VALUE_NET_COLUMN_GROUP,
} from '@/lib/kosztorys/stage-keys'

export const COLUMN_LABELS: Record<string, string> = {
  actions: 'Akcje',
  sectionName: 'Sekcja',
  description: pl.grid.description,
  plannedQty: pl.grid.plannedQty,
  currentPlannedQty: pl.grid.currentPlannedQty,
  stageQtySum: 'Pomiar z natury (etapy razem)',
  divergence: 'Rozjazd między arkuszem Google a apką',
  unit: pl.grid.unit,
  priceMode: 'Źródło ceny wykonawcy',
  priceCoeff: 'Mnożnik',
  price: pl.grid.price,
  priceGross: 'Cena j.m. brutto',
  discountType: 'Rabat',
  discountValue: 'Rabat wart.',
  discountAmount: 'Rabat kwota netto',
  discountAmountGross: 'Rabat kwota brutto',
  plannedNet: 'Wartość przedmiaru netto',
  plannedGross: 'Wartość przedmiaru brutto',
  currentPlannedNet: 'Wartość netto aktualizacji przedmiaru',
  currentPlannedGross: 'Wartość brutto aktualizacji przedmiaru',
  plannedNetForPlane: pl.grid.plannedNetForPlane,
  remainingForPlane: pl.grid.remainingForPlane,
  net: 'Wartość netto (razem etapy)',
  gross: 'Wartość brutto (razem etapy)',
  remaining: 'Pozostało netto (względem aktualizacji przedmiaru)',
  remainingGross: 'Pozostało brutto (względem aktualizacji przedmiaru)',
  stages: 'Etapy — ilość',
  stageValueNet: 'Etapy — kwota netto',
  stageValueGross: 'Etapy — kwota brutto',
  donePercent: '% wykonania (względem aktualizacji przedmiaru)',
  plannedDonePercent: pl.grid.plannedDonePercent,
  note: 'Komentarz',
  aiPlannedQty: 'AI przedmiar (na ile AI wyceniło pracę)',
  aiPlannedNet: 'AI wartość netto przedmiar',
  aiComment: 'Komentarz AI',
  aiNewInformation: 'Nowe informacje',
  reviewStatus: 'Status',
  changeReason: 'Powód zmiany (co AI zrobiło źle)',
  workNote: 'Komentarz do pracy (niewidoczny dla klienta)',
}

// A map rather than a key
// lookup by column id: `net` and `stageValueNet` name other things there.
const TRANSLATED_LABEL_KEYS: Partial<Record<string, MessageKeyT<'grid'>>> = {
  description: 'description',
  plannedQty: 'plannedQty',
  currentPlannedQty: 'currentPlannedQty',
  unit: 'unit',
  price: 'price',
  plannedNetForPlane: 'plannedNetForPlane',
  remainingForPlane: 'remainingForPlane',
  plannedDonePercent: 'plannedDonePercent',
}

/**
 * The client label carries no „po rabacie": it is
 * printed on the investor's document, where it read as a granted rabat on offers that had none.
 */
export function columnLabelForView(
  id: string,
  view: PriceViewT,
  dictionary: TranslatorT<'grid'> = POLISH_GRID,
): string {
  const labelOf = (key: string) => {
    const translated = TRANSLATED_LABEL_KEYS[key]
    return translated ? dictionary.t(translated) : (COLUMN_LABELS[key] ?? key)
  }
  const planeOf = (plane: keyof typeof PLANE_LABEL_KEYS) =>
    dictionary.t(PLANE_LABEL_KEYS[plane]).toLowerCase()
  const planePrice = planePriceKeyParts(id)
  if (planePrice !== null) {
    const { base, plane } = planePrice
    return `${labelOf(base)} — ${planeOf(plane)}`
  }
  const translationLanguage = translationColumnLanguage(id)
  if (translationLanguage !== null)
    return `${labelOf('description')} (${LANGUAGE_SHORT[translationLanguage]})`
  const label = labelOf(id)
  if (id === 'net' || id === 'gross') {
    if (view === 'client') return label
    // Brutto never reaches the worker's link, so only netto has a translation.
    return id === 'net'
      ? dictionary.t('netForPlane', { plane: planeOf(view) })
      : `Suma etapów ${PLANE_LABELS[view].toLowerCase()} brutto`
  }
  if (id === 'stageQtySum' && view !== 'client')
    return dictionary.t('stageQtySumForPlane', { plane: planeOf(view) })
  if (id === 'plannedNetForPlane' && view !== 'client') return `${label} — ${planeOf(view)}`
  return label
}

export const PRZEDMIAR_ANCHORED_COLUMNS: ReadonlySet<string> = new Set([
  'plannedGross',
  'currentPlannedGross',
  'remainingGross',
])

export const CREW_PLANE_ONLY_COLUMNS: ReadonlySet<string> = new Set(['plannedNetForPlane'])

// A column
// absent from this map is neutral: axisAllows fails open, so a forgotten tag shows a column, never hides one.
export const COLUMN_MONEY_AXIS: Record<string, 'net' | 'gross'> = {
  price: 'net',
  priceGross: 'gross',
  discountAmount: 'net',
  discountAmountGross: 'gross',
  plannedNet: 'net',
  plannedGross: 'gross',
  currentPlannedNet: 'net',
  currentPlannedGross: 'gross',
  plannedNetForPlane: 'net',
  aiPlannedNet: 'net',
  net: 'net',
  gross: 'gross',
  remaining: 'net',
  remainingGross: 'gross',
  [STAGE_VALUE_NET_COLUMN_GROUP]: 'net',
  [STAGE_VALUE_GROSS_COLUMN_GROUP]: 'gross',
}

export const COLUMN_LAYER: Record<string, 'work' | 'progress'> = {
  [STAGE_VALUE_NET_COLUMN_GROUP]: 'progress',
  [STAGE_VALUE_GROSS_COLUMN_GROUP]: 'progress',
  donePercent: 'progress',
  plannedDonePercent: 'progress',
  remaining: 'progress',
  remainingGross: 'progress',
}

export const LAYER_NEUTRAL_COLUMNS: ReadonlySet<string> = new Set([
  'actions',
  'sectionName',
  'description',
  ...ALL_TRANSLATION_COLUMN_KEYS,
  'stageQtySum',
  'currentPlannedQty',
  'divergence',
  'note',
  ...AI_REVIEW_COLUMN_IDS,
])

export const UNPICKABLE_COLUMNS: ReadonlySet<string> = new Set(['divergence'])

// `price` is the only editable money cell — the owner types prices while reading brutto, so the mode
// must never take it away.
export const AXIS_EXEMPT_COLUMNS: ReadonlySet<string> = new Set(['price'])

const DISCOUNT_COLUMN_IDS: ReadonlySet<string> = new Set([
  'discountValue',
  'discountType',
  'discountAmount',
  'discountAmountGross',
])

// One rule for the grid, its picker and the printed offer — a copy that drifts prints a per-item
// rabat beside a zero kwota rabatu.
export const bypassedByGlobalDiscount = (key: string, globalDiscountActive = false) =>
  globalDiscountActive && DISCOUNT_COLUMN_IDS.has(key)

export type ColumnGroupT = {
  label: string
  keys: readonly string[]
}

export const DEFAULT_HIDDEN_COLUMNS: ReadonlySet<string> = new Set([
  STAGE_VALUE_GROSS_COLUMN_GROUP,
  'sectionName',
  ...ALL_TRANSLATION_COLUMN_KEYS,
  ...AI_REVIEW_COLUMN_IDS,
])
