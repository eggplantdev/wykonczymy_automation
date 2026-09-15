// FIXTURE (EX-668): seeds the netto-materiały plane into the test dataset. The prod dump carries
// ZERO `INVESTMENT_EXPENSE_NET` rows and exactly one investment with a `materials_net_rate` saved
// (which has no netto wydatek to apply it to), so `materialsNetBilled` and the „wszystko netto"
// concession are frozen at 0 for every investment in `pnpm test:parity` — both DB specs pass green
// having compared nothing on the branch this seed exists to cover.
//
// Fourth step of the db-test reset, after `pnpm db:import:test`, `pnpm seed:kosztorys:test` and
// `pnpm seed:deposits:test`:
//
//   pnpm seed:materials-net:test
//
// Refuses any database but `wykonczymy-test` — this writes the REAL transfers plane in raw SQL, so
// nothing in the app would flag fabricated wydatki landing in the dev DB or in Neon. The
// `pnpm seed:materials-net:test` prefix is what points it at 5435; the guard is what makes every
// other way of running it fail loudly.
//
// A NEW investment at a fixed id rather than rows bolted onto an existing one. The golden master
// compares only the investments its committed fixture already names, so an id it has never seen is
// ignored — where hanging a netto wydatek on investment #7 would move that investment's figures and
// demand a fixture regeneration for a change that moved no production money.
//
// Raw SQL rather than Payload for the same reason as `seed-deposit-planes.ts`: `afterChange` on
// `transactions` syncs the row to the owner's LIVE sheet, and a fixture has no business there.
import { getPayload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import config from '../payload.config'
import { getDb } from '@/lib/db/get-db'
import { getNetAmountError } from '@/lib/utils/validation'

const MARKER = '[fixture:materials-net]'
const TEST_DATABASE = 'wykonczymy-test'

// Reserved ids, far above anything the sequences will reach (the dump sits under 200 investments and
// under 4k transactions). Explicit ids never advance a sequence, so neither can collide with a real
// insert — and a fixed id is what keeps the fixture comparable run to run.
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
  // Brutto, unsettled — the base the „wszystko netto" concession is computed off. Without one the
  // concession is 0 whatever the rate says, so the rate would still be untested.
  {
    type: 'INVESTMENT_EXPENSE',
    amount: 12_300,
    netAmount: null,
    settled: false,
    date: '2026-06-05',
    label: 'materiał brutto',
  },
  // The whole point: bills at netto while the kasa loses brutto. The two numbers are deliberately
  // NOT VAT apart — a regression that derives one from the other has to move a figure to be caught.
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
  // Settled brutto — „wliczone w robociznę", so it leaves materiały and lowers marża instead. Here
  // to keep the seeded investment's split three-way, which is where a bucketing regression shows.
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
