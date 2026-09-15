// E2E fixture for the filter-blindness of the v2 investment panel (EX-634). Seeds ONE investment
// carrying a kosztorys plus a deliberately mixed set of transactions, so that a narrowing URL filter
// on /inwestycje/[id] has something real to narrow: each type below is the only row of its type, so
// `?type=<T>` leaves exactly one transaction in the table below the panel while every panel figure
// must stay put.
//
// The robocizna/rabat amounts disagree with the kosztorys on purpose — the same shape
// seed-kosztorys-reconciliation.ts uses — because the fourth risk is that the mismatch scream was
// muted whenever a filter was active.
//
// Deterministic and self-contained: reads no Google Sheet.
//
// Run against the isolated test DB (mirrors e2e/global-setup.ts):
//   DB_POSTGRES_URL=$DB_POSTGRES_URL_TEST node --env-file=.env --import tsx \
//     src/scripts/seed-panel-filter-blind.ts
//
// Emits one machine-readable line the E2E spec parses:
//   PANEL_SEED={"investment":<id>,"name":"…","laborCostsNet":500,…}
import { getPayload } from 'payload'
import config from '../payload.config'
import { DEFAULT_EXPENSE_CATEGORY_NAME } from '@/lib/constants/transfers'

// Register 5 exists in the standard dump (see e2e/helpers.ts) and is what every register-bearing
// type below books against.
const SOURCE_REGISTER_ID = 5
const CLIENT_PRICE = 100
const QTY_DONE = 5
// „Robocizna" as the kosztorys states it: clientPrice × Σ qtyDone, no rabat on the item.
const LABOR_COSTS_NET = CLIENT_PRICE * QTY_DONE
// Deliberately ≠ LABOR_COSTS_NET, and a rabat the kosztorys does not carry: both make the
// reconciliation scream, which is the signal the filter used to mute.
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

// The transaction afterChange balance hook calls revalidateTag, which throws outside a Next request
// context. disableTransaction lets the insert survive that throw; balances are read-computed, so the
// lost revalidation is a no-op in a script.
async function seedTransaction(
  payload: Awaited<ReturnType<typeof getPayload>>,
  txn: TxnSeed,
): Promise<void> {
  try {
    await payload.create({
      collection: 'transactions',
      disableTransaction: true,
      data: { ...txn, paymentMethod: 'TRANSFER', date: new Date().toISOString() },
      // The sheet id comes from the DB and every non-production database is a restored prod dump, so
      // a fixture transaction is one `after()` away from the owner's live arkusz. The credential is
      // the real gate; this is the one that does not depend on which machine the seed runs on.
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

  // Tryb NET: one money column, so the panel's figures read as single values rather than a
  // netto/brutto pair — the spec compares whole rows, and one column keeps the comparison legible.
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

  // `seedTransaction` swallows the revalidation throw, so „the script finished" is not „the rows
  // landed" — and a spec that seeded nothing would read the panel's zeros as the figures under test.
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
