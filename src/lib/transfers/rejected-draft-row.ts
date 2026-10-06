import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import type { ReferenceDataBaseT } from '@/types/reference-data'
import type { TransferRowT } from '@/types/transfers'

export function rejectedDraftToRow(
  draft: ExpenseDraftRowT,
  refData: ReferenceDataBaseT,
): TransferRowT {
  const register = [...refData.cashRegisters, ...refData.trashedCashRegisters].find(
    (candidate) => candidate.id === draft.cashRegisterId,
  )
  return {
    id: 0,
    rejectedDraftId: draft.id,
    description: draft.note ?? '',
    amount: 0,
    netAmount: null,
    type: 'INVESTMENT_EXPENSE',
    paymentMethod: null,
    date: draft.sentAt,
    sourceRegisterId: draft.cashRegisterId,
    sourceRegisterName: register?.name ?? '—',
    targetRegisterId: null,
    targetRegisterName: '—',
    sourceRegisterTrashed: !refData.cashRegisters.some((live) => live.id === draft.cashRegisterId),
    targetRegisterTrashed: false,
    investmentId: draft.investmentId,
    investmentName: draft.investmentName,
    expenseCategoryId: null,
    expenseCategoryName: '—',
    otherCategoryName: '—',
    otherCategoryId: null,
    workerName: '—',
    workerId: null,
    createdByName: draft.workerName,
    createdById: draft.workerId,
    createdAt: draft.sentAt,
    invoices: draft.media,
    invoiceNote: null,
    cancelled: false,
    settled: false,
    vatPlane: null,
    originalType: null,
  }
}
