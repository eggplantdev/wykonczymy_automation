import { describe, expect, it } from 'vitest'
import {
  toMoney,
  workCatalogueItemFormSchema,
  workCatalogueItemSchema,
} from '@/components/forms/work-catalogue-item/work-catalogue-item-schema'

const values = (overrides: Partial<Record<string, unknown>> = {}) => ({
  description: 'Malowanie ścian',
  category: 'Malowanie',
  unit: 'm2',
  clientPrice: 50,
  wToolsRate: 30,
  ownToolsRate: 20,
  ...overrides,
})

describe('toMoney', () => {
  it('reads a comma as the decimal separator', () => {
    expect(toMoney('12,50')).toBe(12.5)
  })

  it('refuses a blank field instead of reading it as 0 zł', () => {
    expect(toMoney('')).toBeNaN()
    expect(toMoney('   ')).toBeNaN()
  })

  it('refuses half-typed garbage', () => {
    expect(toMoney('1e')).toBeNaN()
    expect(toMoney('-')).toBeNaN()
  })
})

// The layer the „Nowa praca w katalogu" dialog validates against — it is what decides whether the
// owner sees a sentence UNDER the field he left empty, or a toast after the write was attempted.
describe('workCatalogueItemFormSchema', () => {
  const formValues = (overrides: Partial<Record<string, string | boolean>> = {}) => ({
    description: 'Malowanie ścian',
    category: '',
    unit: 'm2',
    clientPrice: '50',
    wToolsAuto: false,
    wToolsRate: '30',
    ownToolsAuto: false,
    ownToolsRate: '20',
    ...overrides,
  })

  const issuesFor = (overrides: Partial<Record<string, string | boolean>>) =>
    workCatalogueItemFormSchema.safeParse(formValues(overrides)).error?.issues ?? []

  const issueFor = (field: string, raw: string) => {
    const result = workCatalogueItemFormSchema.safeParse(formValues({ [field]: raw }))
    return result.error?.issues.find((issue) => issue.path[0] === field)
  }

  it('names a blank price as missing, not as „nie liczba"', () => {
    expect(issueFor('clientPrice', '')?.message).toBe('Cena j.m. jest wymagana')
    expect(issueFor('clientPrice', '   ')?.message).toBe('Cena j.m. jest wymagana')
  })

  it('pins the message to the field it belongs to, so it renders under that input', () => {
    expect(issueFor('ownToolsRate', '')?.path).toEqual(['ownToolsRate'])
  })

  it('separates garbage from a missing value', () => {
    expect(issueFor('wToolsRate', '1e')?.message).toBe(
      'Stawka z narzędziami (podwykonawca) musi być liczbą',
    )
  })

  it('refuses a negative figure', () => {
    expect(issueFor('clientPrice', '-5')?.message).toBe('Cena j.m. nie może być ujemna')
  })

  it('„auto" zdejmuje wymóg kwoty z własnego planu', () => {
    expect(issuesFor({ wToolsAuto: true, wToolsRate: '' })).toEqual([])
  })

  it('„auto" na jednym planie nie zdejmuje wymogu z drugiego', () => {
    const issues = issuesFor({ wToolsAuto: true, wToolsRate: '', ownToolsRate: '' })
    expect(issues.map((issue) => issue.path[0])).toEqual(['ownToolsRate'])
    expect(issues[0].message).toBe('Stawka bez narzędzi (pracownik) jest wymagana')
  })

  it('puste pole przy odznaczonym „auto" nadal jest błędem', () => {
    expect(issueFor('wToolsRate', '')?.message).toBe(
      'Stawka z narzędziami (podwykonawca) jest wymagana',
    )
  })

  it('accepts a comma as the decimal separator', () => {
    expect(
      workCatalogueItemFormSchema.safeParse(formValues({ clientPrice: '12,50' })).success,
    ).toBe(true)
  })
})

describe('workCatalogueItemSchema', () => {
  it('rejects a blank price with the figure named', () => {
    const result = workCatalogueItemSchema.safeParse(values({ clientPrice: toMoney('') }))
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Cena j.m. musi być liczbą')
  })

  it('rejects a negative stawka', () => {
    const result = workCatalogueItemSchema.safeParse(values({ wToolsRate: -1 }))
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      'Stawka z narzędziami (podwykonawca) nie może być ujemna',
    )
  })

  it('accepts a zero stawka — a praca the company does not subcontract', () => {
    expect(workCatalogueItemSchema.safeParse(values({ ownToolsRate: 0 })).success).toBe(true)
  })

  it('przyjmuje null jako „auto" — brak stawki to nie brak liczby', () => {
    expect(workCatalogueItemSchema.safeParse(values({ wToolsRate: null })).success).toBe(true)
  })
})
