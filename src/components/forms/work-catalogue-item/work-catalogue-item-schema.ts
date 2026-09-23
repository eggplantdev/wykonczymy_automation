import { z } from 'zod'
import { PRICE_SOURCES, RATE_LABELS } from '@/lib/kosztorys/constants'
import {
  catalogueSourceOf,
  type CatalogueRateColumnsT,
} from '@/lib/kosztorys/work-catalogue/catalogue-rate'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'

// A blank „Cena j.m." must be refused HERE rather than by the domain schema below: `Number('')` is 0,
// so it would otherwise save a 0 zł pozycja — and a 0 zł cena also silences the ceiling for that
// row, since a share of nothing has no value to show. Validating the string means the owner gets
// „jest wymagana" under the field he left empty, instead of the domain layer's „musi być liczbą"
// (true of a NaN, nonsense about a blank) arriving as a toast after the write was already attempted.
const moneyIssue = (label: string, value: string): string | null => {
  const parsed = parseDecimalInput(value)
  if (parsed.kind === 'empty') return `${label} jest wymagana`
  if (parsed.kind === 'invalid') return `${label} musi być liczbą`
  if (parsed.value < 0) return `${label} nie może być ujemna`
  return null
}

// A mnożnik has its own sentences: „stawka musi być liczbą" under a field asking for a krotność
// reads as the wrong field entirely. Zero is allowed — a wpis that deliberately pays nothing on a
// płaszczyźnie is a decision, the same one the rozpiska's cell accepts.
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

// Form-input layer: every field is a string, as the HTML controls produce them — except the źródło,
// which is a choice rather than something typed.
const baseSchema = z.object({
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
})

// The guard on a stawka is conditional on ITS OWN źródło, and a field-level refinement cannot see a
// sibling field — so it lives on the object. „Auto" is a decision; a blank field under either of the
// other two źródła is still „zapomniałem" and still says so, under the field that is actually empty.
export const workCatalogueItemFormSchema = baseSchema.superRefine((value, ctx) => {
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
})

const text = (value: number | null): string => value?.toString() ?? ''

/**
 * „Co katalog trzyma" → „co formularz pokazuje", in one place so the trzy dialogi opening this form
 * cannot each decode the pair of kolumn their own way.
 */
export const rateFormValues = (item: CatalogueRateColumnsT) => ({
  wToolsSource: catalogueSourceOf({ rate: item.wToolsRate, coeff: item.wToolsRateCoeff }),
  wToolsRate: text(item.wToolsRate),
  wToolsCoeff: text(item.wToolsRateCoeff),
  ownToolsSource: catalogueSourceOf({ rate: item.ownToolsRate, coeff: item.ownToolsRateCoeff }),
  ownToolsRate: text(item.ownToolsRate),
  ownToolsCoeff: text(item.ownToolsRateCoeff),
})

export type WorkCatalogueItemFormValuesT = z.infer<typeof workCatalogueItemFormSchema>

const money = (label: string) =>
  z.number({ message: `${label} musi być liczbą` }).min(0, `${label} nie może być ujemna`)

const coeff = (label: string) =>
  z
    .number({ message: `Mnożnik (${label}) musi być liczbą` })
    .min(0, `Mnożnik (${label}) nie może być ujemny`)

// Domain layer the action validates — the backstop for a payload that never passed through the form.
// The źródło selectors are absent: they are a form affordance, and what the katalog stores is their
// result — the pair of kolumn, at most one of them set. `matchKey` is absent on purpose too: it is
// derived server-side from opis + j.m., and Zod strips unknown keys, so a client that sends one is
// simply ignored.
export const workCatalogueItemSchema = baseSchema
  .omit({ wToolsSource: true, ownToolsSource: true, wToolsCoeff: true, ownToolsCoeff: true })
  .extend({
    category: z.string().default(''),
    clientPrice: money('Cena j.m.'),
    // A blank field is NOT „auto" — the form layer above still refuses it.
    wToolsRate: money(RATE_LABELS.w_tools).nullable(),
    wToolsRateCoeff: coeff(RATE_LABELS.w_tools).nullable(),
    ownToolsRate: money(RATE_LABELS.own_tools).nullable(),
    ownToolsRateCoeff: coeff(RATE_LABELS.own_tools).nullable(),
  })
  // Both kolumny set is the state the rozpiska's own zapis refuses, for the same reason: the pair
  // would name two źródła at once, and every reader resolves that by precedence rather than by
  // asking. A payload that skipped the form is where it could still arrive.
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
