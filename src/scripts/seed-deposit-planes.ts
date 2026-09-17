// FIXTURE (EX-725): seeds wpłaty brutto into the test dataset. Its original reason has largely
// expired — counted 2026-09-17, the dump itself holds 27 wpłaty `vat_plane='GROSS'` z `net_amount`
// across 22 investments, so `grossDepositsWithNet > 2` and the golden master's brutto axis both
// clear on a bare import. What it still buys is DETERMINISM on that axis: fixed ids and fixed kwoty
// on two known investments — one with a kosztorys, one without — so the brutto plane is exercised
// at a known figure rather than at whatever prod last happened to book.
//
// Third step of the db-test reset, after `pnpm db:import:test` and `pnpm seed:kosztorys:test`:
//
//   pnpm seed:deposits:test
//
// Refuses any database but `wykonczymy-test`. This is the first seed script writing the REAL
// transfers plane (AGENTS.md scopes the throwaway rule to kosztorys only), the write is raw SQL so no
// `afterChange` fires to flag it, and ~257 400 zł of fabricated wpłaty landing in the dev DB — or in
// Neon — would be silent. The `pnpm seed:deposits:test` prefix is what points it at 5435; the guard is
// what makes running it any other way fail loudly instead of corrupting a real ledger.
//
// Idempotent in row CONTENT and in row IDENTITY. Identity is the load-bearing half: the golden
// master's comparability key is a `sig` that starts with the row `id`, so sequence-assigned ids would
// re-hash both seeded investments on every run, drop them into `dataMoved`, and skip them past the
// entire figure comparison — a green `test:parity` that compares nothing on the plane this fixture
// exists to guard. Hence the fixed id block below and a wipe keyed on the marker ALONE: the second
// investment is resolved from data, so a wipe narrowed to this run's targets would strand the
// previous run's rows the moment that pick moves.
//
// The write goes through raw SQL rather than Payload because of the hooks: `afterChange` and
// `afterDelete` on `transactions` both run the sheet sync, and only `afterChange` honours
// `skipSheetSync` — a fixture has no business invoking either. Note what this is NOT: since the
// write-credential gate (2026-08-27) that sync cannot reach a sheet from a dev machine at all —
// `getWritableSheetsClient` throws without `GOOGLE_SERVICE_ACCOUNT_WRITE_JSON`, which exists only in
// Vercel Production. The hooks are skipped because they are noise and call `revalidateTag` outside a
// request context, not because a fabricated wpłata could land in the owner's arkusz. Every row is
// still put through `getNetAmountError` below — the same single instance of the rule the dialog
// uses — so skipping the hook is not skipping validation.
import { getPayload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import config from '../payload.config'
import { getDb } from '@/lib/db/get-db'
import { getNetAmountError } from '@/lib/utils/validation'

const MARKER = '[fixture:gross-deposit]'
const TEST_DATABASE = 'wykonczymy-test'
const KOSZTORYS_INVESTMENT_ID = Number(process.env.INV ?? 7)

// Reserved block, far above anything `transactions_id_seq` will reach (the dump sits under 4k rows).
// Explicit ids never advance the sequence, so this cannot collide with a real insert.
const FIRST_ID = 900_001

type SeedRowT = {
  amount: number
  // The netto the faktura named. Deliberately NOT `amount ÷ (1+VAT)`: a bill made of robocizna and
  // materials carries two rates, so the netto is READ, not derived. A regression that derives it
  // moves the number.
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

  // Second investment resolved from data rather than hard-coded: the ids come out of the prod dump.
  // Without a kosztorys — so a wpłata brutto exists where robocizna read from the kosztorys is zero
  // too, i.e. the „klient nadpłacił" state, in which the bilans brutto is the only figure that moves.
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
      // An error here is a typo in the amounts above: the seed must stop before inserting a row the
      // app itself could never have saved.
      if (error) {
        throw new Error(`wiersz ${row.amount}/${row.netAmount} na inw. ${investmentId}: ${error}`)
      }
    }
  }

  const investmentIds = targets.map((t) => t.investmentId)
  // Marker only, deliberately not narrowed to `investmentIds`: see the identity note in the header.
  const gone = await db.execute(sql`
    DELETE FROM transactions
    WHERE description LIKE ${`${MARKER}%`}
    RETURNING id
  `)

  let seeded = 0
  let nextId = FIRST_ID
  for (const { investmentId, rows } of targets) {
    // Kasa from this investment's last wpłata — `INVESTOR_DEPOSIT` requires one, and picking it from
    // data keeps the seed resilient to the ids the dump happens to carry.
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
