import { describe, it, expect } from 'vitest'
import {
  availableExpenseDatasets,
  clientVisibleExpenseRows,
  partitionExpenseRows,
  expenseRowHref,
  sumAmount,
} from '@/lib/kosztorys/expense-datasets'
import type { MaterialTransactionRowT } from '@/types/transfers'
import type { PreviewFileT } from '@/types/media'

const ROW_BASE = {
  date: '2026-07-26',
  label: 'Materiały',
  description: null,
  invoices: [] as PreviewFileT[],
  invoiceNote: null,
} as const

const rows: MaterialTransactionRowT[] = [
  { ...ROW_BASE, id: 1, type: 'INVESTMENT_EXPENSE', amount: 100, billed: 100, settled: false },
  { ...ROW_BASE, id: 2, type: 'CORRECTION', amount: -25, billed: -25, settled: false },
  {
    ...ROW_BASE,
    id: 3,
    type: 'INVESTMENT_EXPENSE_NET',
    amount: 1230,
    billed: 1000,
    settled: false,
  },
  { ...ROW_BASE, id: 4, type: 'INVESTMENT_EXPENSE', amount: 40, billed: 40, settled: true },
]

describe('partitionExpenseRows', () => {
  it('assigns every row to exactly one tab', () => {
    const { gross, net, settled } = partitionExpenseRows(rows)
    expect([...gross, ...net, ...settled].map((row) => row.id).sort()).toEqual([1, 2, 3, 4])
  })

  it('keeps a forged settled netto row in the netto tab, where the model still bills it', () => {
    const forged: MaterialTransactionRowT = {
      ...ROW_BASE,
      id: 5,
      type: 'INVESTMENT_EXPENSE_NET',
      amount: 1230,
      billed: 1000,
      settled: true,
    }
    const { net, settled } = partitionExpenseRows([forged])

    expect(net).toHaveLength(1)
    expect(settled).toHaveLength(0)
  })
})

describe('availableExpenseDatasets', () => {
  it('offers a tab only for a non-empty set, in reading order', () => {
    expect(availableExpenseDatasets(partitionExpenseRows(rows))).toEqual([
      'gross',
      'net',
      'settled',
    ])
    expect(availableExpenseDatasets(partitionExpenseRows([rows[0]!, rows[3]!]))).toEqual([
      'gross',
      'settled',
    ])
    expect(availableExpenseDatasets(partitionExpenseRows([rows[2]!]))).toEqual(['net'])
    expect(availableExpenseDatasets(partitionExpenseRows([]))).toEqual([])
  })
})

describe('expenseRowHref', () => {
  it('links each row to a list filtered by its own type', () => {
    const href = (row: MaterialTransactionRowT) => expenseRowHref(42, row)

    expect(href(rows[0]!)).toBe('/inwestycje/42?type=INVESTMENT_EXPENSE&id=1')
    expect(href(rows[1]!)).toBe('/inwestycje/42?type=CORRECTION&id=2')
    expect(href(rows[2]!)).toBe('/inwestycje/42?type=INVESTMENT_EXPENSE_NET&id=3')
  })
})

describe('clientVisibleExpenseRows', () => {
  it('drops the settled set — a client would otherwise rebuild the withheld figure row by row', () => {
    expect(clientVisibleExpenseRows(rows).map((row) => row.id)).toEqual([1, 2, 3])
  })

  it('keeps a settled netto row, because the model still bills it to the investor', () => {
    const settledNet: MaterialTransactionRowT = {
      ...ROW_BASE,
      id: 5,
      type: 'INVESTMENT_EXPENSE_NET',
      amount: 1230,
      billed: 1000,
      settled: true,
    }
    expect(clientVisibleExpenseRows([settledNet]).map((row) => row.id)).toEqual([5])
  })
})

describe('sumAmount', () => {
  it('sums what left the kasa — the netto invoice at its brutto, a korekta with its sign', () => {
    expect(sumAmount(clientVisibleExpenseRows(rows))).toBe(100 - 25 + 1230)
  })
})
