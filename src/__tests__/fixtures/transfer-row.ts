import type { TransferRowT } from '@/types/transfers'

/** A neutral transfer row; every spec overrides only the fields it asserts on. */
export function transferRow(overrides: Partial<TransferRowT> = {}): TransferRowT {
  return {
    id: 1,
    description: '',
    amount: 0,
    netAmount: null,
    type: 'INVESTMENT_EXPENSE',
    paymentMethod: null,
    date: '2026-01-01',
    sourceRegisterId: null,
    sourceRegisterName: '—',
    targetRegisterId: null,
    targetRegisterName: '—',
    investmentId: null,
    investmentName: '—',
    expenseCategoryId: null,
    expenseCategoryName: '—',
    otherCategoryName: '—',
    otherCategoryId: null,
    workerName: '—',
    workerId: null,
    createdByName: '—',
    createdById: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    invoices: [],
    invoiceNote: null,
    cancelled: false,
    settled: false,
    vatPlane: null,
    originalType: null,
    ...overrides,
  }
}
