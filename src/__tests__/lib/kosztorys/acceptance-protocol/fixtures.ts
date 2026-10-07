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
    reviewRequested: false,
    hasSheet: false,
    createdAt: '2026-01-15T10:00:00.000Z',
    materialsNetRate: null,
    settlementMode: 'NET',
    vatRate: 0.08,
    ...overrides,
  }
}
