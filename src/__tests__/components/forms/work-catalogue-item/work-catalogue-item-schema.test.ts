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
  wToolsRateCoeff: null,
  ownToolsRate: 20,
  ownToolsRateCoeff: null,
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
    wToolsSource: 'amount',
    wToolsRate: '30',
    wToolsCoeff: '',
    ownToolsSource: 'amount',
    ownToolsRate: '20',
    ownToolsCoeff: '',
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
    expect(issuesFor({ wToolsSource: 'auto', wToolsRate: '' })).toEqual([])
  })

  // Pusty mnożnik to ta sama pomyłka co pusta kwota, ale pod innym polem — i zdanie o stawce pod
  // polem pytającym o krotność czytałoby się jak błąd w zupełnie innym miejscu.
  it('mnożnik ma własny wymóg i własne pole', () => {
    const issues = issuesFor({ wToolsSource: 'coeff', wToolsRate: '', wToolsCoeff: '' })
    expect(issues.map((issue) => issue.path[0])).toEqual(['wToolsCoeff'])
    expect(issues[0].message).toBe('Mnożnik (Stawka z narzędziami (podwykonawca)) jest wymagany')
  })

  it('przy mnożniku pusta kwota nikogo nie obchodzi', () => {
    expect(issuesFor({ wToolsSource: 'coeff', wToolsRate: '', wToolsCoeff: '0,65' })).toEqual([])
  })

  it('„auto" na jednym planie nie zdejmuje wymogu z drugiego', () => {
    const issues = issuesFor({ wToolsSource: 'auto', wToolsRate: '', ownToolsRate: '' })
    expect(issues.map((issue) => issue.path[0])).toEqual(['ownToolsRate'])
    expect(issues[0].message).toBe('Stawka bez narzędzi (pracownik) jest wymagana')
  })

  it('puste pole przy „kwocie stałej" nadal jest błędem', () => {
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

  it('przyjmuje sam mnożnik, bez kwoty', () => {
    expect(
      workCatalogueItemSchema.safeParse(values({ wToolsRate: null, wToolsRateCoeff: 0.65 }))
        .success,
    ).toBe(true)
  })

  // Obie kolumny naraz nazywałyby dwa źródła jednocześnie, a każdy czytelnik rozstrzyga to
  // pierwszeństwem zamiast pytaniem — ten payload omija formularz, więc backstop musi go odrzucić.
  it('odrzuca kwotę i mnożnik naraz na jednym planie', () => {
    const result = workCatalogueItemSchema.safeParse(values({ wToolsRateCoeff: 0.65 }))
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      'Stawka z narzędziami (podwykonawca): kwota i mnożnik wykluczają się.',
    )
  })

  it('odrzuca ujemny mnożnik', () => {
    const result = workCatalogueItemSchema.safeParse(
      values({ wToolsRate: null, wToolsRateCoeff: -1 }),
    )
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      'Mnożnik (Stawka z narzędziami (podwykonawca)) nie może być ujemny',
    )
  })
})
