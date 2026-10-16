// Identity is the load-bearing half: the golden master's comparability key is a `sig` that starts
// with the row `id`, so sequence-assigned ids would re-hash both seeded investments on every run,
// drop them into `dataMoved`, and skip them past the entire figure comparison. Hence the fixed id
// block below and a wipe keyed on the marker ALONE: the second investment is resolved from data, so a
// wipe narrowed to this run's targets would strand the previous run's rows the moment that pick moves.
import { getPayload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import config from '../payload.config'
import { getDb } from '@/lib/db/get-db'
import { getNetAmountError } from '@/lib/utils/validation'

const MARKER = '[fixture:gross-deposit]'
const TEST_DATABASE = 'wykonczymy-test'
const KOSZTORYS_INVESTMENT_ID = Number(process.env.INV ?? 7)

// Reserved block, far above anything `transactions_id_seq` will reach.
const FIRST_ID = 900_001

type SeedRowT = {
  amount: number
  // Deliberately NOT `amount ÷ (1+VAT)`: a bill made of robocizna and
  // materials carries two rates, so the netto is READ, not derived.
  netAmount: number
  date: string
}

const KOSZTORYS_ROWS: SeedRowT[] = [
  { amount: 129_600, netAmount: 118_000, date: '2026-06-10' },
  { amount: 54_000, netAmount: 49_000, date: '2026-06-24' },
  { amount: 8_640, netAmount: 8_000, date: '2026-07-08' },
]

const SECOND_ROWS: SeedRowT[] = [{ amount: 32_400, netAmount: 29_500, date: '2026-06-18' }]

const LABEL = `${MARKER} przelew z faktury`

async function run() {
  const payload = await getPayload({ config })
  const db = await getDb(payload)

  const current = await db.execute(sql`SELECT current_database() AS name`)
  const database = String(current.rows[0]?.name ?? '')
  if (database !== TEST_DATABASE) {
    throw new Error(
      `odmawiam zapisu do bazy "${database}" — ten seed pisze wyłącznie do "${TEST_DATABASE}". ` +
        `Uruchom go przez \`pnpm seed:deposits:test\`.`,
    )
  }

  const second = await db.execute(sql`
    SELECT t.investment_id AS id
    FROM transactions t
    WHERE t.type = 'INVESTOR_DEPOSIT'
      AND t.cancelled IS NOT TRUE
      AND t.investment_id IS NOT NULL
      AND t.investment_id <> ${KOSZTORYS_INVESTMENT_ID}
      AND NOT EXISTS (SELECT 1 FROM kosztorys_items ki WHERE ki.investment_id = t.investment_id)
    GROUP BY t.investment_id
    ORDER BY t.investment_id
    LIMIT 1
  `)
  const secondInvestmentId = second.rows[0] ? Number(second.rows[0].id) : null
  if (secondInvestmentId === null) {
    throw new Error(
      'brak inwestycji bez kosztorysu z wpłatami — czy dump jest zaimportowany (pnpm db:import:test)?',
    )
  }

  const targets: { investmentId: number; rows: SeedRowT[] }[] = [
    { investmentId: KOSZTORYS_INVESTMENT_ID, rows: KOSZTORYS_ROWS },
    { investmentId: secondInvestmentId, rows: SECOND_ROWS },
  ]

  for (const { investmentId, rows } of targets) {
    for (const row of rows) {
      const error = getNetAmountError(row.netAmount, row.amount, 'INVESTOR_DEPOSIT', 'GROSS')
      if (error) {
        throw new Error(`wiersz ${row.amount}/${row.netAmount} na inw. ${investmentId}: ${error}`)
      }
    }
  }

  const investmentIds = targets.map((t) => t.investmentId)
  const gone = await db.execute(sql`
    DELETE FROM transactions
    WHERE description LIKE ${`${MARKER}%`}
    RETURNING id
  `)

  let seeded = 0
  let nextId = FIRST_ID
  for (const { investmentId, rows } of targets) {
    const register = await db.execute(sql`
      SELECT source_register_id AS id
      FROM transactions
      WHERE type = 'INVESTOR_DEPOSIT'
        AND investment_id = ${investmentId}
        AND source_register_id IS NOT NULL
      ORDER BY date DESC, id DESC
      LIMIT 1
    `)
    const registerId = register.rows[0] ? Number(register.rows[0].id) : null
    if (registerId === null) {
      throw new Error(`inw. ${investmentId} nie ma wpłaty z kasą — nie ma z czego wziąć kasy`)
    }

    for (const row of rows) {
      await db.execute(sql`
        INSERT INTO transactions
          (id, description, amount, net_amount, vat_plane, date, type, payment_method,
           source_register_id, investment_id, cancelled, settled)
        VALUES
          (${nextId}, ${LABEL}, ${row.amount}, ${row.netAmount}, 'GROSS', ${row.date}::timestamptz,
           'INVESTOR_DEPOSIT', 'TRANSFER', ${registerId}, ${investmentId}, false, false)
      `)
      nextId++
      seeded++
    }
  }

  console.log(
    `Fixture wpłat brutto: usunięto ${gone.rows.length}, wstawiono ${seeded} ` +
      `(inw. ${investmentIds.join(', ')}, id ${FIRST_ID}..${nextId - 1})`,
  )
  process.exit(0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
