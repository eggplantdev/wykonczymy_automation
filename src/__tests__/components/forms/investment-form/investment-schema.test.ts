import { describe, it, expect } from 'vitest'
import { investmentSchema } from '@/components/forms/investment-form/investment-schema'

const parseMarket = (market: '' | 'primary' | 'secondary') =>
  investmentSchema.parse({
    name: 'Inwestycja',
    status: 'quote',
    presetId: '',
    initialInfo: { market },
  }).initialInfo

describe('investmentSchema — „Wstępne informacje”', () => {
  it('sends an unchosen „Rynek” as null, which Payload’s select accepts', () => {
    expect(parseMarket('')).toEqual({ market: null })
  })

  it('keeps a chosen „Rynek”', () => {
    expect(parseMarket('primary')).toEqual({ market: 'primary' })
  })
})
