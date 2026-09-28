import type { InvestmentRefT } from '@/types/reference-data'

export function investment(overrides: Partial<InvestmentRefT> = {}): InvestmentRefT {
  return {
    id: 42,
    name: 'Jan Testowy Kwiatowa 1/2',
    status: 'active',
    address: 'ul. Kwiatowa 1/2, Kraków',
    phone: '600 000 000',
    email: 'jan@example.test',
    contactPerson: '',
    notes: 'klucze u sąsiada',
    review: 'ok',
    hasSheet: false,
    materialsNetRate: null,
    settlementMode: 'NET',
    vatRate: 0.08,
    ...overrides,
  }
}
