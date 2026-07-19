// One-off: add a few visible expenses to investment 31 so the podsumowanie
// materiały figures have data. Run:
//   node --env-file=.env --import tsx src/scripts/seed-inv31-expenses.ts
import { getPayload } from 'payload'
import config from '../payload.config'

const INVESTMENT_ID = 31
const SOURCE_REGISTER_ID = 5
const MATERIALY_WYKONCZENIOWE = 2
const OTHER_CATEGORY_INNE = 6

const rows = [
  {
    type: 'INVESTMENT_EXPENSE',
    description: 'Farby i gładzie',
    amount: 1850,
    expenseCategory: MATERIALY_WYKONCZENIOWE,
  },
  {
    type: 'INVESTMENT_EXPENSE',
    description: 'Panele podłogowe',
    amount: 4200,
    expenseCategory: MATERIALY_WYKONCZENIOWE,
  },
  {
    type: 'INVESTMENT_EXPENSE',
    description: 'Płytki łazienkowe',
    amount: 3100,
    expenseCategory: MATERIALY_WYKONCZENIOWE,
  },
  { type: 'OTHER', description: 'Wywóz gruzu', amount: 600, otherCategory: OTHER_CATEGORY_INNE },
  {
    type: 'OTHER',
    description: 'Drobne materiały pomocnicze',
    amount: 340,
    otherCategory: OTHER_CATEGORY_INNE,
  },
] as const

async function main() {
  const payload = await getPayload({ config })
  for (const row of rows) {
    // disableTransaction: the afterChange balance hook calls revalidateTag, which
    // throws outside a Next request context. Without a wrapping tx the insert
    // survives that throw; balances are read-computed so the lost revalidation
    // is a no-op in a one-off script.
    try {
      const created = await payload.create({
        collection: 'transactions',
        disableTransaction: true,
        data: {
          ...row,
          investment: INVESTMENT_ID,
          sourceRegister: SOURCE_REGISTER_ID,
          paymentMethod: 'TRANSFER',
          date: new Date().toISOString(),
        },
      })
      console.log(`created #${created.id} ${row.type} ${row.description} ${row.amount}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('static generation store')) {
        console.log(`created (revalidate skipped) ${row.type} ${row.description} ${row.amount}`)
      } else {
        throw error
      }
    }
  }
  console.log('done')
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
