import { z } from 'zod'
import {
  descriptionTranslationsSchema,
  translationTexts,
  translationTextsSchema,
} from '@/lib/i18n/description-translations'
import { TRANSLATION_LANGUAGES } from '@/lib/i18n/languages'
import { PRICE_SOURCES } from '@/lib/kosztorys/constants'
import { RATE_LABELS } from '@/lib/kosztorys/labels'
import {
  catalogueSourceOf,
  type CatalogueRateColumnsT,
  type CatalogueRateT,
} from '@/lib/kosztorys/work-catalogue/catalogue-rate'
import { parseDecimalInput, toMoney } from '@/lib/utils/parse-decimal-input'

// A blank „Cena j.m." must be refused HERE rather than by the domain schema below: `Number('')` is 0,
// so it would otherwise save a 0 zł pozycja.
const moneyIssue = (label: string, value: string): string | null => {
  const parsed = parseDecimalInput(value)
  if (parsed.kind === 'empty') return `${label} jest wymagana`
  if (parsed.kind === 'invalid') return `${label} musi być liczbą`
  if (parsed.value < 0) return `${label} nie może być ujemna`
  return null
}

const coeffIssue = (label: string, value: string): string | null => {
  const parsed = parseDecimalInput(value)
  if (parsed.kind === 'empty') return `Mnożnik (${label}) jest wymagany`
  if (parsed.kind === 'invalid') return `Mnożnik (${label}) musi być liczbą`
  if (parsed.value < 0) return `Mnożnik (${label}) nie może być ujemny`
  return null
}

const RATE_PLANES = [
  {
    source: 'wToolsSource',
    rate: 'wToolsRate',
    coeff: 'wToolsCoeff',
    label: RATE_LABELS.w_tools,
  },
  {
    source: 'ownToolsSource',
    rate: 'ownToolsRate',
    coeff: 'ownToolsCoeff',
    label: RATE_LABELS.own_tools,
  },
] as const

export const workCatalogueItemBaseSchema = z.object({
  description: z.string().min(1, 'Opis pracy jest wymagany'),
  category: z.string(),
  unit: z.string().min(1, 'Jednostka miary jest wymagana'),
  clientPrice: z.string().superRefine((value, ctx) => {
    const message = moneyIssue('Cena j.m.', value)
    if (message) ctx.addIssue({ code: 'custom', message })
  }),
  wToolsSource: z.enum(PRICE_SOURCES),
  wToolsRate: z.string(),
  wToolsCoeff: z.string(),
  ownToolsSource: z.enum(PRICE_SOURCES),
  ownToolsRate: z.string(),
  ownToolsCoeff: z.string(),
  // The catch lets a draft persisted before the field
  // existed still submit, instead of failing on a field nobody can see.
  translations: z.record(z.enum(TRANSLATION_LANGUAGES), z.string()).catch(translationTexts({})),
  workNote: z.string().catch(''),
})

export type RatePlaneValuesT = Pick<
  z.infer<typeof workCatalogueItemBaseSchema>,
  | 'wToolsSource'
  | 'wToolsRate'
  | 'wToolsCoeff'
  | 'ownToolsSource'
  | 'ownToolsRate'
  | 'ownToolsCoeff'
>

export function refineRatePlanes(value: RatePlaneValuesT, ctx: z.RefinementCtx) {
  for (const plane of RATE_PLANES) {
    const source = value[plane.source]
    if (source === 'auto') continue
    const field = source === 'coeff' ? plane.coeff : plane.rate
    const message =
      source === 'coeff'
        ? coeffIssue(plane.label, value[plane.coeff])
        : moneyIssue(plane.label, value[plane.rate])
    if (message) ctx.addIssue({ code: 'custom', message, path: [field] })
  }
}

export const workCatalogueItemFormSchema = workCatalogueItemBaseSchema.superRefine(refineRatePlanes)

const text = (value: number | null): string => value?.toString() ?? ''

export type PlaneT = 'wTools' | 'ownTools'

const rateColumns = (plane: PlaneT, value: RatePlaneValuesT): CatalogueRateT => {
  const source = value[`${plane}Source`]
  return {
    rate: source === 'amount' ? toMoney(value[`${plane}Rate`]) : null,
    coeff: source === 'coeff' ? toMoney(value[`${plane}Coeff`]) : null,
  }
}

export const catalogueFigures = (value: RatePlaneValuesT & { clientPrice: string }) => {
  const wTools = rateColumns('wTools', value)
  const ownTools = rateColumns('ownTools', value)
  return {
    clientPrice: toMoney(value.clientPrice),
    wToolsRate: wTools.rate,
    wToolsRateCoeff: wTools.coeff,
    ownToolsRate: ownTools.rate,
    ownToolsRateCoeff: ownTools.coeff,
  }
}

export const rateFormValues = (item: CatalogueRateColumnsT) => ({
  wToolsSource: catalogueSourceOf({ rate: item.wToolsRate, coeff: item.wToolsRateCoeff }),
  wToolsRate: text(item.wToolsRate),
  wToolsCoeff: text(item.wToolsRateCoeff),
  ownToolsSource: catalogueSourceOf({ rate: item.ownToolsRate, coeff: item.ownToolsRateCoeff }),
  ownToolsRate: text(item.ownToolsRate),
  ownToolsCoeff: text(item.ownToolsRateCoeff),
})

export type WorkCatalogueItemFormValuesT = z.infer<typeof workCatalogueItemFormSchema>

export const EMPTY_CATALOGUE_ITEM_VALUES: WorkCatalogueItemFormValuesT = {
  description: '',
  category: '',
  unit: '',
  clientPrice: '',
  wToolsSource: 'auto',
  wToolsRate: '',
  wToolsCoeff: '',
  ownToolsSource: 'auto',
  ownToolsRate: '',
  ownToolsCoeff: '',
  translations: translationTexts({}),
  workNote: '',
}

const money = (label: string) =>
  z.number({ message: `${label} musi być liczbą` }).min(0, `${label} nie może być ujemna`)

const coeff = (label: string) =>
  z
    .number({ message: `Mnożnik (${label}) musi być liczbą` })
    .min(0, `Mnożnik (${label}) nie może być ujemny`)

export const workCatalogueItemSchema = workCatalogueItemBaseSchema
  .omit({
    wToolsSource: true,
    ownToolsSource: true,
    wToolsCoeff: true,
    ownToolsCoeff: true,
    translations: true,
  })
  .extend({
    category: z.string().default(''),
    // Never the whole map: a dialog opened on a cached row would write its stale copy back over
    // translations saved since.
    translationEdits: translationTextsSchema.optional(),
    translationSeed: descriptionTranslationsSchema.optional(),
    workNote: z.string().optional(),
    clientPrice: money('Cena j.m.'),
    wToolsRate: money(RATE_LABELS.w_tools).nullable(),
    wToolsRateCoeff: coeff(RATE_LABELS.w_tools).nullable(),
    ownToolsRate: money(RATE_LABELS.own_tools).nullable(),
    ownToolsRateCoeff: coeff(RATE_LABELS.own_tools).nullable(),
  })
  .superRefine((value, ctx) => {
    for (const plane of RATE_PLANES) {
      const coeffField = `${plane.rate}Coeff` as 'wToolsRateCoeff' | 'ownToolsRateCoeff'
      if (value[plane.rate] !== null && value[coeffField] !== null) {
        ctx.addIssue({
          code: 'custom',
          message: `${plane.label}: kwota i mnożnik wykluczają się.`,
          path: [coeffField],
        })
      }
    }
  })

export type WorkCatalogueItemDataT = z.infer<typeof workCatalogueItemSchema>
