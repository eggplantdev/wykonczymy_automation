import { z } from 'zod'
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

const RATE_PLANES = [
  { rate: 'wToolsRate', auto: 'wToolsAuto', label: 'Stawka z narzędziami' },
  { rate: 'ownToolsRate', auto: 'ownToolsAuto', label: 'Stawka bez narzędzi' },
] as const

// Form-input layer: every field is a string, as the HTML controls produce them.
const baseSchema = z.object({
  description: z.string().min(1, 'Opis pracy jest wymagany'),
  category: z.string(),
  unit: z.string().min(1, 'Jednostka miary jest wymagana'),
  clientPrice: z.string().superRefine((value, ctx) => {
    const message = moneyIssue('Cena j.m.', value)
    if (message) ctx.addIssue({ code: 'custom', message })
  }),
  wToolsAuto: z.boolean(),
  wToolsRate: z.string(),
  ownToolsAuto: z.boolean(),
  ownToolsRate: z.string(),
})

// The money guard on a stawka is conditional on ITS OWN przełącznik, and a field-level refinement
// cannot see a sibling field — so it lives on the object. „Auto" is a decision; a blank field with
// the przełącznik off is still „zapomniałem" and still says „jest wymagana".
export const workCatalogueItemFormSchema = baseSchema.superRefine((value, ctx) => {
  for (const plane of RATE_PLANES) {
    if (value[plane.auto]) continue
    const message = moneyIssue(plane.label, value[plane.rate])
    if (message) ctx.addIssue({ code: 'custom', message, path: [plane.rate] })
  }
})

export type WorkCatalogueItemFormValuesT = z.infer<typeof workCatalogueItemFormSchema>

const money = (label: string) =>
  z.number({ message: `${label} musi być liczbą` }).min(0, `${label} nie może być ujemna`)

// Domain layer the action validates — the backstop for a payload that never passed through the form.
// The przełączniki are absent: they are a form affordance, and what the katalog stores is their
// result. `matchKey` is absent on purpose too: it is derived server-side from opis + j.m., and Zod
// strips unknown keys, so a client that sends one is simply ignored.
export const workCatalogueItemSchema = baseSchema
  .omit({ wToolsAuto: true, ownToolsAuto: true })
  .extend({
    category: z.string().default(''),
    clientPrice: money('Cena j.m.'),
    // A blank field is NOT „auto" — the form layer above still refuses it.
    wToolsRate: money('Stawka z narzędziami').nullable(),
    ownToolsRate: money('Stawka bez narzędzi').nullable(),
  })

export type WorkCatalogueItemDataT = z.infer<typeof workCatalogueItemSchema>

/** „12,50" → 12.5; blank and garbage → NaN, which `money()` refuses. */
export function toMoney(value: string): number {
  const parsed = parseDecimalInput(value)
  return parsed.kind === 'value' ? parsed.value : NaN
}
