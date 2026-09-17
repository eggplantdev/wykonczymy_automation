// FIXTURE (EX-668): seeds the netto-materiały plane. Without it the dump has zero
// `INVESTMENT_EXPENSE_NET` rows and `pnpm test:parity` compares nothing here.
// Fourth db-test reset step: `pnpm seed:materials-net:test`; refuses any DB but `wykonczymy-test`.
// The fixed investment id is what makes it reproducible, not what hides it — inw. 900101 IS in the
// golden-master fixture, and its wydatki move kasa #5 there too, so this seed is part of the reset
// ritual rather than optional. Raw SQL, not Payload, so the rows
// carry explicit ids and no hook fires (`recalculate-balances` calls `revalidateTag`, which throws
// outside a request context). NOT because of the arkusz: since 2026-08-27 a sheet write needs
// `GOOGLE_SERVICE_ACCOUNT_WRITE_JSON`, which lives only in Vercel Production, so the sync throws
// long before Google is reached.
import { getPayload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import config from '../payload.config'
import { getDb } from '@/lib/db/get-db'
import { getNetAmountError } from '@/lib/utils/validation'

const MARKER = '[fixture:materials-net]'
const TEST_DATABASE = 'wykonczymy-test'

// Reserved ids well above the dump's range (under 200 investments, under 4k transactions) — explicit
// ids don't advance sequences, so they can't collide with a real insert.
const INVESTMENT_ID = 900_101
const FIRST_TRANSACTION_ID = 910_001

// „Mieszane" keeps a saved rate effective (tryb brutto makes it inert), so this is the combination
// that actually exercises `effectiveMaterialsNetRate` returning a number.
const SETTLEMENT_MODE = 'MIXED'
const MATERIALS_NET_RATE = 0.08
const VAT_RATE = 0.23

type ExpenseRowT = {
  type: 'INVESTMENT_EXPENSE' | 'INVESTMENT_EXPENSE_NET'
  amount: number
  /** What the faktura named. Only the netto type bills at it; a brutto row leaves it null. */
  netAmount: number | null
  settled: boolean
  date: string
  label: string
}

const ROWS: ExpenseRowT[] = [
  // Brutto, unsettled — the base the „wszystko netto" concession is computed off; without it the
  // concession is 0 whatever the rate says.
  {
    type: 'INVESTMENT_EXPENSE',
    amount: 12_300,
    netAmount: null,
    settled: false,
    date: '2026-06-05',
    label: 'materiał brutto',
  },
  // Bills at netto while the kasa loses brutto; the two are deliberately not VAT apart, so a
  // regression deriving one from the other moves a figure.
  {
    type: 'INVESTMENT_EXPENSE_NET',
    amount: 9_840,
    netAmount: 8_000,
    settled: false,
    date: '2026-06-12',
    label: 'materiał netto z faktury',
  },
  {
    type: 'INVESTMENT_EXPENSE_NET',
    amount: 3_075,
    netAmount: 2_500,
    settled: false,
    date: '2026-06-26',
    label: 'materiał netto z faktury',
  },
  // Settled brutto — „wliczone w robociznę": leaves materiały, lowers marża. Keeps the split
  // three-way, where a bucketing regression shows.
  {
    type: 'INVESTMENT_EXPENSE',
    amount: 4_500,
    netAmount: null,
    settled: true,
    date: '2026-07-02',
    label: 'materiał wliczony w robociznę',
  },
]

async function run() {
  const payload = await getPayload({ config })
  const db = await getDb(payload)

  const current = await db.execute(sql`SELECT current_database() AS name`)
  const database = String(current.rows[0]?.name ?? '')
  if (database !== TEST_DATABASE) {
    throw new Error(
      `odmawiam zapisu do bazy "${database}" — ten seed pisze wyłącznie do "${TEST_DATABASE}". ` +
        `Uruchom go przez \`pnpm seed:materials-net:test\`.`,
    )
  }

  for (const row of ROWS) {
    const error = getNetAmountError(row.netAmount, row.amount, row.type, null)
    if (error) throw new Error(`wiersz „${row.label}" ${row.amount}/${row.netAmount}: ${error}`)
  }

  // Kasa and kategoria come from data — the ids are whatever the dump happens to carry.
  const register = await db.execute(sql`SELECT id FROM cash_registers ORDER BY id LIMIT 1`)
  const registerId = register.rows[0] ? Number(register.rows[0].id) : null
  if (registerId === null) {
    throw new Error('brak kasy w bazie — czy dump jest zaimportowany (pnpm db:import:test)?')
  }
  const category = await db.execute(sql`SELECT id FROM expense_categories ORDER BY id LIMIT 1`)
  const categoryId = category.rows[0] ? Number(category.rows[0].id) : null
  if (categoryId === null) {
    throw new Error('brak kategorii wydatku w bazie — czy dump jest zaimportowany?')
  }

  // Transactions first: their FK onto investments is ON DELETE SET NULL, so dropping the investment
  // would orphan a previous run's wydatki into the „bez inwestycji" bucket instead of removing them.
  const gone = await db.execute(sql`
    DELETE FROM transactions WHERE description LIKE ${`${MARKER}%`} RETURNING id
  `)
  await db.execute(sql`DELETE FROM investments WHERE id = ${INVESTMENT_ID}`)

  await db.execute(sql`
    INSERT INTO investments
      (id, name, status, vat_rate, settlement_mode, materials_net_rate, updated_at, created_at)
    VALUES
      (${INVESTMENT_ID}, ${`${MARKER} materiały netto`}, 'active', ${VAT_RATE},
       ${SETTLEMENT_MODE}::enum_investments_settlement_mode, ${MATERIALS_NET_RATE}, now(), now())
  `)

  let nextId = FIRST_TRANSACTION_ID
  for (const row of ROWS) {
    await db.execute(sql`
      INSERT INTO transactions
        (id, description, amount, net_amount, date, type, payment_method, source_register_id,
         investment_id, expense_category_id, cancelled, settled)
      VALUES
        (${nextId}, ${`${MARKER} ${row.label}`}, ${row.amount}, ${row.netAmount},
         ${row.date}::timestamptz, ${row.type}::enum_transactions_type,
         ${row.type === 'INVESTMENT_EXPENSE_NET' ? 'TRANSFER' : null}::enum_transactions_payment_method,
         ${registerId}, ${INVESTMENT_ID}, ${categoryId}, false, ${row.settled})
    `)
    nextId++
  }

  console.log(
    `Fixture materiałów netto: usunięto ${gone.rows.length}, wstawiono ${ROWS.length} ` +
      `(inw. ${INVESTMENT_ID}, id ${FIRST_TRANSACTION_ID}..${nextId - 1})`,
  )
  process.exit(0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
