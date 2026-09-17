// E2E fixture for the investor share route (`/k/<token>`) — EX-696, EX-721, EX-570, EX-681.
// One fresh investment carrying everything the public page renders, including a deliberately EMPTY
// item (what „Ukryj pozycje bez przedmiaru…" is about) and an expense with a real invoice page.
//
// Fresh per run rather than a fixed id: the test DB is never reset, and the spec writes client-view
// settings and share tokens onto whatever it is pointed at — on a shared investment that leaks into
// the next spec. Every transaction uses `skipSheetSync`, so a fixture can never reach a live sheet.
//
// Run against the isolated test DB (mirrors e2e/global-setup.ts):
//   DB_POSTGRES_URL=$DB_POSTGRES_URL_TEST node --env-file=.env --import tsx \
//     src/scripts/seed-client-share.ts
//
// Emits one machine-readable line the spec parses: CLIENT_SHARE_SEED={…}
import path from 'node:path'
import { getPayload } from 'payload'
import config from '../payload.config'

const CLIENT_PRICE = 100
const PLANNED_QTY = 10
const QTY_DONE = 3

const ctx = { context: { skipRevalidation: true, skipSheetSync: true } }

async function main() {
  const payload = await getPayload({ config })
  const stamp = Date.now()

  const [register] = (await payload.find({ collection: 'cash-registers', limit: 1 })).docs
  if (!register) throw new Error('[client-share-seed] no cash register in the test DB')
  const [category] = (await payload.find({ collection: 'expense-categories', limit: 1 })).docs
  if (!category) throw new Error('[client-share-seed] no expense category in the test DB')

  const investment = await payload.create({
    collection: 'investments',
    data: {
      name: `E2E Share ${stamp}`,
      status: 'active',
      vatRate: 0.23,
      // Mieszane, so gotówka and przelew are both on-plane — otherwise one row renders as a mistake
      // the owner is being warned about.
      settlementMode: 'MIXED',
    },
    ...ctx,
  })
  const stage = await payload.create({
    collection: 'kosztorys-stages',
    data: { investment: investment.id, ordinal: 1, label: 'Etap 1' },
    ...ctx,
  })
  const section = await payload.create({
    collection: 'kosztorys-sections',
    data: { investment: investment.id, name: `Roboty ${stamp}`, displayOrder: 0 },
    ...ctx,
  })

  const item = (description: string, plannedQty: number, displayOrder: number) =>
    payload.create({
      collection: 'kosztorys-items',
      data: {
        investment: investment.id,
        section: section.id,
        displayOrder,
        description,
        unit: 'm2',
        plannedQty,
        discountValue: 0,
        clientPrice: CLIENT_PRICE,
      },
      ...ctx,
    })

  const workedRow = `Wykonana pozycja ${stamp}`
  const emptyRow = `Pusta pozycja ${stamp}`
  const worked = await item(workedRow, PLANNED_QTY, 0)
  await payload.create({
    collection: 'stage-progress',
    data: { item: worked.id, stage: stage.id, qtyDone: QTY_DONE },
    ...ctx,
  })
  // No przedmiar and no stage-progress at all — the one row the „ukryj puste pozycje" tick removes.
  await item(emptyRow, 0, 1)

  const invoicePage = await payload.create({
    collection: 'media',
    filePath: path.join(process.cwd(), 'e2e/fixtures/paragon-a.jpg'),
    data: { alt: 'Paragon' },
    ...ctx,
  })

  const cashDeposit = { amount: 5_000, date: '2026-06-01' }
  const transferDeposit = { amount: 12_300, netAmount: 10_000, date: '2026-06-15' }
  await payload.create({
    collection: 'transactions',
    data: {
      type: 'INVESTOR_DEPOSIT',
      investment: investment.id,
      sourceRegister: register.id,
      amount: cashDeposit.amount,
      date: cashDeposit.date,
      paymentMethod: 'CASH',
      vatPlane: 'NET',
      description: `Wpłata gotówką ${stamp}`,
    },
    ...ctx,
  })
  await payload.create({
    collection: 'transactions',
    data: {
      type: 'INVESTOR_DEPOSIT',
      investment: investment.id,
      sourceRegister: register.id,
      amount: transferDeposit.amount,
      netAmount: transferDeposit.netAmount,
      date: transferDeposit.date,
      paymentMethod: 'TRANSFER',
      vatPlane: 'GROSS',
      description: `Wpłata przelewem ${stamp}`,
    },
    ...ctx,
  })

  const grossExpense = { description: `Wydatek brutto ${stamp}`, amount: 2_460 }
  const netExpense = { description: `Wydatek netto ${stamp}`, amount: 1_230, netAmount: 1_000 }
  // The company's own spend: its dataset is dropped from the share entirely (the disclosure half of
  // EX-570), so it must not reach the client's list.
  const settledExpense = { description: `Wydatek wliczony ${stamp}`, amount: 999 }

  await payload.create({
    collection: 'transactions',
    data: {
      type: 'INVESTMENT_EXPENSE',
      investment: investment.id,
      sourceRegister: register.id,
      expenseCategory: category.id,
      amount: grossExpense.amount,
      date: '2026-06-20',
      description: grossExpense.description,
      invoice: [invoicePage.id],
    },
    ...ctx,
  })
  await payload.create({
    collection: 'transactions',
    data: {
      type: 'INVESTMENT_EXPENSE_NET',
      investment: investment.id,
      sourceRegister: register.id,
      expenseCategory: category.id,
      amount: netExpense.amount,
      netAmount: netExpense.netAmount,
      date: '2026-06-21',
      paymentMethod: 'TRANSFER',
      description: netExpense.description,
    },
    ...ctx,
  })
  await payload.create({
    collection: 'transactions',
    data: {
      type: 'INVESTMENT_EXPENSE',
      investment: investment.id,
      sourceRegister: register.id,
      expenseCategory: category.id,
      amount: settledExpense.amount,
      date: '2026-06-22',
      description: settledExpense.description,
      settled: true,
    },
    ...ctx,
  })

  console.log(
    `CLIENT_SHARE_SEED=${JSON.stringify({
      investment: investment.id,
      investmentName: investment.name,
      sectionName: section.name,
      workedRow,
      emptyRow,
      cashDeposit,
      transferDeposit,
      grossExpense,
      netExpense,
      settledExpense,
      invoiceFilename: invoicePage.filename,
    })}`,
  )
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
