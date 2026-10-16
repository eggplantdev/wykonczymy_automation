import { cached } from '@/lib/cache/cached'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { getPayoutTransactionsForInvestment } from '@/lib/db/get-payout-transactions'
import { getDepositTransactionsForInvestment } from '@/lib/db/get-deposit-transactions'
import { findTransfersRaw } from '@/lib/queries/transfers'
import { fetchMediaByIds } from '@/lib/queries/media'
import { fetchExpenseCategories } from '@/lib/queries/reference-data'
import { extractInvoiceIds, resolveInvoiceFiles } from '@/lib/media/invoice-field'
import { billedAmountFor, EXPENSES_TAB_TYPES } from '@/lib/constants/transfers'
import type {
  PayoutTransactionRowT,
  DepositTransactionRowT,
  MaterialTransactionRowT,
} from '@/types/transfers'

export async function fetchPayoutTransactionsForInvestment(
  investmentId: number,
): Promise<PayoutTransactionRowT[]> {
  return cached(
    async () => {
      const payload = await getPayload({ config })
      return getPayoutTransactionsForInvestment(payload, investmentId)
    },
    ['payout-transactions', String(investmentId)],
    { tags: [CACHE_TAGS.transfers] },
  )()
}

// Deliberately kept as an investment-only entry point: the unauthenticated share read reaches this
// fetcher, so it must expose no filter parameter a caller could widen.
export async function fetchDepositTransactionsForInvestment(
  investmentId: number,
): Promise<DepositTransactionRowT[]> {
  return cached(
    async () => {
      const payload = await getPayload({ config })
      return getDepositTransactionsForInvestment(payload, investmentId)
    },
    ['deposit-transactions', String(investmentId)],
    { tags: [CACHE_TAGS.transfers] },
  )()
}

/**
 * Only names are joined; `fetchReferenceData` would drag along company-wide PII that has no business
 * on the share path.
 */
export async function fetchMaterialTransactionsForInvestment(
  investmentId: number,
): Promise<MaterialTransactionRowT[]> {
  const [{ docs }, expenseCategories] = await Promise.all([
    findTransfersRaw({
      where: {
        investment: { equals: investmentId },
        type: { in: [...EXPENSES_TAB_TYPES] },
        cancelled: { not_equals: true },
      },
      page: 1,
      limit: 0,
      sort: '-date',
    }),
    fetchExpenseCategories(),
  ])
  const nameById = new Map(expenseCategories.map((category) => [category.id, category.name]))
  const mediaById = await fetchMediaByIds(extractInvoiceIds(docs))

  return docs.map((doc) => {
    return {
      id: Number(doc.id),
      date: String(doc.date),
      type: doc.type,
      amount: Number(doc.amount),
      billed: billedAmountFor(
        doc.type,
        Number(doc.amount),
        doc.netAmount == null ? null : Number(doc.netAmount),
      ),
      description: doc.description != null ? String(doc.description) : null,
      settled: doc.settled === true,
      label:
        doc.expenseCategory != null
          ? (nameById.get(Number(doc.expenseCategory)) ?? 'Nieznana kategoria')
          : doc.type === 'CORRECTION'
            ? 'Korekta'
            : 'Bez kategorii',
      invoices: resolveInvoiceFiles(doc.invoice, mediaById),
      invoiceNote: doc.invoiceNote != null ? String(doc.invoiceNote) : null,
    }
  })
}
