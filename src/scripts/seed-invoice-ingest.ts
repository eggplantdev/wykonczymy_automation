import type { Payload } from 'payload'
import { EXPENSE_CATEGORY, EXPENSE_INVESTMENT, EXPENSE_REGISTER } from '@/scripts/e2e-dump-rows'

const ctx = { context: { skipRevalidation: true, skipSheetSync: true } }

// One faktura-less wydatek per test, owned by the e2e user — „Edytuj transakcję" is enabled only on
// the viewer's own row.
export async function seedInvoiceIngest(payload: Payload, ownerId: number) {
  const stamp = Date.now()
  const [investment] = (
    await payload.find({
      collection: 'investments',
      where: { name: { equals: EXPENSE_INVESTMENT } },
      limit: 1,
    })
  ).docs
  const [category] = (
    await payload.find({
      collection: 'expense-categories',
      where: { name: { equals: EXPENSE_CATEGORY } },
      limit: 1,
    })
  ).docs
  if (!investment || !category)
    throw new Error('[invoice-ingest-seed] the test DB lacks the dump investment or category')

  const ownExpense = async (tag: string) => {
    const description = `E2E-${tag}-${stamp}`
    await payload.create({
      collection: 'transactions',
      data: {
        type: 'INVESTMENT_EXPENSE',
        investment: investment.id,
        sourceRegister: EXPENSE_REGISTER.id,
        expenseCategory: category.id,
        amount: 1.23,
        date: new Date().toISOString(),
        description,
        createdBy: ownerId,
      },
      ...ctx,
    })
    return description
  }

  return {
    heic: await ownExpense('heic'),
    blocked: await ownExpense('blocked'),
    cell: await ownExpense('cell'),
    bigPdf: await ownExpense('big-pdf'),
  }
}
