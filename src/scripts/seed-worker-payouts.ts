// Manual-check fixture for „Pozostało do wypłaty" and „Rozlicz wypłaty" (EX-919) — the pair shapes
// the prod dump lacks. Idempotent: every run deletes what the previous one seeded and rebuilds it.
//
//   Wypłaty A    Jan on a settled etap                  → payable, ahead-payable
//   Wypłaty B    Jan + Piotr, an etap with nobody on it, a wypłata booked with nobody
//                                                         → two workers + „Nieprzypisane"
//   Wypłaty C    Piotr on an etap with work but no rozliczenie → withheld
//   Wypłaty D    Jan on a settled etap, then zakończona  → locked
//
// Run: pnpm seed:worker-payouts (test DB, 5435)
import { getPayload, type Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import config from '@payload-config'
import { getDb } from '@/lib/db/get-db'
import { LOCKED_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

const PREFIX = 'Seed wypłaty'
const PAYOUT_MARKER = 'seed-worker-payouts'
const WORKERS = {
  jan: { email: 'seed-wyplaty-jan@example.com', name: 'Jan Seedowy' },
  piotr: { email: 'seed-wyplaty-piotr@example.com', name: 'Piotr Seedowy' },
} as const
const ITEMS = [{ description: 'Pozycja', unit: 'm2', plannedQty: 20, clientPrice: 100 }]

// A throwaway password on fabricated EMPLOYEE accounts is harmless on the dump copies — but a script
// that writes users has no business near the Neon URL, so it refuses anything but localhost.
function assertLocalDb(): void {
  const url = process.env.DB_POSTGRES_URL ?? ''
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {}
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error(`[seed-worker-payouts] refusing: DB host "${host}" is not localhost`)
  }
}

async function findOrCreateWorker(payload: Payload, spec: { email: string; name: string }) {
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: spec.email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs[0]) return Number(existing.docs[0].id)
  const created = await payload.create({
    collection: 'users',
    data: { ...spec, password: `seed-${Date.now()}`, role: 'EMPLOYEE', active: true },
    overrideAccess: true,
    context: { skipRevalidation: true },
  })
  return Number(created.id)
}

async function main() {
  assertLocalDb()
  const payload = await getPayload({ config })
  const db = await getDb(payload)

  await db.execute(sql`DELETE FROM transactions WHERE description LIKE ${`${PAYOUT_MARKER}%`}`)
  const previous = await payload.find({
    collection: 'investments',
    where: { name: { like: PREFIX } },
    limit: 0,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  for (const doc of previous.docs) {
    // A zakończona inwestycja refuses the delete; it is reopened first.
    await db.execute(sql`UPDATE investments SET status = 'active' WHERE id = ${doc.id}`)
    await deleteTestInvestment(payload, Number(doc.id))
  }

  const jan = await findOrCreateWorker(payload, WORKERS.jan)
  const piotr = await findOrCreateWorker(payload, WORKERS.piotr)

  const tree = (
    stages: { plane: 'w_tools' | 'own_tools' | null; worker: number | null }[],
    qtyDone: number,
  ) => ({
    sections: [{ name: 'Sekcja', items: ITEMS }],
    stages: stages.map((stage, index) => ({ label: `Etap ${index + 1}`, ...stage })),
    progress: stages.map((_, stage) => ({ item: 0, stage, qtyDone })),
  })

  const a = await createTestInvestment(payload, `${PREFIX} A`)
  await createKosztorysTree(payload, a, tree([{ plane: 'w_tools', worker: jan }], 6))

  const b = await createTestInvestment(payload, `${PREFIX} B`)
  await createKosztorysTree(
    payload,
    b,
    tree(
      [
        { plane: 'w_tools', worker: jan },
        { plane: 'own_tools', worker: piotr },
        { plane: 'w_tools', worker: null },
      ],
      4,
    ),
  )

  const c = await createTestInvestment(payload, `${PREFIX} C`)
  await createKosztorysTree(payload, c, tree([{ plane: null, worker: piotr }], 3))

  const d = await createTestInvestment(payload, `${PREFIX} D`)
  await createKosztorysTree(payload, d, tree([{ plane: 'w_tools', worker: jan }], 5))
  await db.execute(sql`UPDATE investments SET status = ${LOCKED_INVESTMENT_STATUS} WHERE id = ${d}`)

  // Raw SQL: a Payload create runs the sheet-sync and revalidation hooks, which need a request scope.
  const payout = (investmentId: number, workerId: number | null, amount: number) =>
    db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, investment_id, worker_id, cancelled)
      VALUES (${PAYOUT_MARKER}, ${amount}, now(), 'PAYOUT'::enum_transactions_type,
        ${investmentId}, ${workerId}, false)
    `)
  await payout(a, jan, 100)
  await payout(b, piotr, 50)
  await payout(b, null, 30)

  console.log(
    `[seed-worker-payouts] investments A=${a} B=${b} C=${c} D=${d}; workers Jan=${jan} Piotr=${piotr}`,
  )
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
