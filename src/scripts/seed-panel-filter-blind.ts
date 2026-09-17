// E2E fixture for filter-blindness of the v2 investment panel (EX-634). One investment, one
// transaction per type, so `?type=<T>` narrows the table to a single row while panel figures stay
// put. robocizna/rabat deliberately disagree with the kosztorys: a filter must not mute the warning.
//
// Run: DB_POSTGRES_URL=$DB_POSTGRES_URL_TEST node --env-file=.env --import tsx src/scripts/seed-panel-filter-blind.ts
// Emits: PANEL_SEED={"investment":<id>,"name":"…","laborCostsNet":500,…}
import { getPayload } from 'payload'
import config from '../payload.config'
import { DEFAULT_EXPENSE_CATEGORY_NAME } from '@/lib/constants/transfers'

// Register 5 exists in the standard dump (e2e/helpers.ts); every register-bearing type books to it.
const SOURCE_REGISTER_ID = 5
const CLIENT_PRICE = 100
const QTY_DONE = 5
// „Robocizna" as the kosztorys states it: clientPrice × Σ qtyDone, no rabat on the item.
const LABOR_COSTS_NET = CLIENT_PRICE * QTY_DONE
// Deliberately ≠ LABOR_COSTS_NET, plus a rabat the kosztorys lacks — both trip the reconciliation.
const LABOR_COST_BOOKED = LABOR_COSTS_NET - 50
const RABAT_BOOKED = 30
const DEPOSIT = 200
const MATERIALS = 300

const ctx = { context: { skipRevalidation: true, skipSheetSync: true } }

type TxnSeed = {
  type: 'LABOR_COST' | 'RABAT' | 'INVESTOR_DEPOSIT' | 'INVESTMENT_EXPENSE'
  amount: number
  investment: number
  description: string
  sourceRegister?: number
  expenseCategory?: number
}

// afterChange calls revalidateTag, which throws outside a Next request context; disableTransaction
// lets the insert survive it — balances are read-computed, so the lost revalidation is a no-op here.
async function seedTransaction(
  payload: Awaited<ReturnType<typeof getPayload>>,
  txn: TxnSeed,
): Promise<void> {
  try {
    await payload.create({
      collection: 'transactions',
      disableTransaction: true,
      data: { ...txn, paymentMethod: 'TRANSFER', date: new Date().toISOString() },
      // Every non-prod DB is a restored prod dump carrying live sheet ids, so without skipSheetSync
      // this transaction is one `after()` away from the owner's real arkusz.
      ...ctx,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('static generation store')) throw error
  }
}

async function main() {
  const payload = await getPayload({ config })
  // A per-run suffix keeps the name unique — the test DB is not reset between runs.
  const name = `E2E Panel filtry ${Date.now()}`

  const categories = await payload.find({
    collection: 'expense-categories',
    where: { name: { equals: DEFAULT_EXPENSE_CATEGORY_NAME } },
    limit: 1,
  })
  const expenseCategory = categories.docs[0]?.id
  if (expenseCategory === undefined)
    throw new Error(
      `[panel-seed] no expense category „${DEFAULT_EXPENSE_CATEGORY_NAME}" in this DB — run pnpm db:import:test`,
    )

  // Tryb NET: one money column, so the spec can compare whole rows as single values, not netto/brutto pairs.
  const investment = await payload.create({
    collection: 'investments',
    data: { name, status: 'active', vatRate: 0.23, settlementMode: 'NET' },
    ...ctx,
  })
  const stage = await payload.create({
    collection: 'kosztorys-stages',
    data: { investment: investment.id, ordinal: 1, label: 'Etap 1' },
    ...ctx,
  })
  const section = await payload.create({
    collection: 'kosztorys-sections',
    data: { investment: investment.id, name: 'Sekcja 1', displayOrder: 0 },
    ...ctx,
  })
  const item = await payload.create({
    collection: 'kosztorys-items',
    data: {
      investment: investment.id,
      section: section.id,
      displayOrder: 0,
      description: 'Pozycja 1',
      unit: 'm2',
      plannedQty: 10,
      discountValue: 0,
      clientPrice: CLIENT_PRICE,
    },
    ...ctx,
  })
  await payload.create({
    collection: 'stage-progress',
    data: { item: item.id, stage: stage.id, qtyDone: QTY_DONE },
    ...ctx,
  })

  await seedTransaction(payload, {
    type: 'LABOR_COST',
    amount: LABOR_COST_BOOKED,
    investment: investment.id,
    description: 'E2E robocizna (niezgodna)',
  })
  await seedTransaction(payload, {
    type: 'RABAT',
    amount: RABAT_BOOKED,
    investment: investment.id,
    description: 'E2E rabat (niezgodny)',
  })
  await seedTransaction(payload, {
    type: 'INVESTOR_DEPOSIT',
    amount: DEPOSIT,
    investment: investment.id,
    sourceRegister: SOURCE_REGISTER_ID,
    description: 'E2E wpłata inwestora',
  })
  await seedTransaction(payload, {
    type: 'INVESTMENT_EXPENSE',
    amount: MATERIALS,
    investment: investment.id,
    sourceRegister: SOURCE_REGISTER_ID,
    expenseCategory,
    description: 'E2E materiały',
  })

  // `seedTransaction` swallows the revalidation throw, so exiting 0 does not mean the rows landed.
  const written = await payload.count({
    collection: 'transactions',
    where: { investment: { equals: investment.id } },
  })
  if (written.totalDocs !== 4)
    throw new Error(`[panel-seed] seeded ${written.totalDocs} transactions, expected 4`)

  console.log(
    `PANEL_SEED=${JSON.stringify({
      investment: investment.id,
      name,
      laborCostsNet: LABOR_COSTS_NET,
      deposit: DEPOSIT,
      materials: MATERIALS,
    })}`,
  )
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
