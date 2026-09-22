import { unstable_cache } from 'next/cache'
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

// Tagged on CACHE_TAGS.transfers alone: the rows carry no worker name — that is resolved downstream off reference data — so a rename must not bust this.
export async function fetchPayoutTransactionsForInvestment(
  investmentId: number,
): Promise<PayoutTransactionRowT[]> {
  return unstable_cache(
    async () => {
      const payload = await getPayload({ config })
      return getPayoutTransactionsForInvestment(payload, investmentId)
    },
    ['payout-transactions', String(investmentId)],
    { tags: [CACHE_TAGS.transfers] },
  )()
}

// Same cache contract as the payout-transactions fetch — transfers tag, no PII to join.
//
// Deliberately kept as an investment-only entry point: the unauthenticated share read reaches this
// fetcher, so it must expose no filter parameter a caller could widen.
export async function fetchDepositTransactionsForInvestment(
  investmentId: number,
): Promise<DepositTransactionRowT[]> {
  return unstable_cache(
    async () => {
      const payload = await getPayload({ config })
      return getDepositTransactionsForInvestment(payload, investmentId)
    },
    // -v2: the row gained `netAmount`, and an entry written by the previous build deserializes
    // without it — `depositRowPair` would then read the przelew's netto off the stawka instead of
    // off the faktura, disagreeing with a listing already keyed `deposit-plane-sums-v2`.
    ['deposit-transactions-v2', String(investmentId)],
    { tags: [CACHE_TAGS.transfers] },
  )()
}

/**
 * The individual materiały rows for the Podsumowanie's wydatki list — this investment's
 * INVESTMENT_EXPENSE + INVESTMENT_EXPENSE_NET + CORRECTION, both settled states, so the list can
 * split them into its three tabs (`partitionExpenseRows` owns the rule and the labels).
 *
 * Shared by the owner's editor page and the unauthenticated client share read, which is why the
 * category-name and invoice joins live here rather than at either page: the two surfaces must label a
 * row — and agree on which rows have a downloadable invoice — identically. Only names are joined;
 * `fetchReferenceData` would drag along company-wide PII that has no business on the share path.
 * `limit: 0` = all rows.
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

  // depth: 0 → `expenseCategory` and `invoice` are raw ids (`expenseCategory` null for a legacy
  // uncategorised row / a CORRECTION).
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
