// E2E fixture for the grid's read path and its write path — EX-497 and EX-604.
//
// Seeds TWO fresh investments of the same shape, one per test, because the write test types new
// quantities into the rozpiska and the read test asserts exact figures: sharing one investment would
// make the second test read whatever the first left behind.
//
// The shape is the smallest one in which both facts are provable:
//   • two etapy, so „Pomiar (razem etapy)" is a SUM of two cells rather than an echo of one;
//   • przedmiar 10 at 100 zł, so „Pozostało" is a round figure that moves by a nameable amount;
//   • three prace, so a run of edits down one column is a real burst and the untouched rows are
//     visible controls.
//
// Run against the isolated test DB (mirrors e2e/global-setup.ts):
//   DB_POSTGRES_URL=$DB_POSTGRES_URL_TEST node --env-file=.env --import tsx \
//     src/scripts/seed-kosztorys-grid.ts
//
// Emits one machine-readable line the spec parses: GRID_SEED={"live":<id>,"writes":<id>}
import { getPayload } from 'payload'
import config from '../payload.config'

const ctx = { context: { skipRevalidation: true, skipSheetSync: true } }

const PLANNED_QTY = 10
const CLIENT_PRICE = 100
const QTY_DONE = 2

// Distinct enough that a substring match on one never hits another — the spec finds rows by their
// rendered text.
const ROWS = ['Praca jeden', 'Praca dwa', 'Praca trzy'] as const

async function seedInvestment(
  payload: Awaited<ReturnType<typeof getPayload>>,
  name: string,
): Promise<number> {
  const investment = await payload.create({
    collection: 'investments',
    data: { name, status: 'active', vatRate: 0.23, settlementMode: 'NET' },
    ...ctx,
  })

  // An explicit plane on both etapy: a plane-less etap renders its quantity column locked, and a
  // locked column cannot be typed into.
  const stages = []
  for (const ordinal of [1, 2]) {
    stages.push(
      await payload.create({
        collection: 'kosztorys-stages',
        data: { investment: investment.id, ordinal, label: `Etap ${ordinal}`, plane: 'w_tools' },
        ...ctx,
      }),
    )
  }

  const section = await payload.create({
    collection: 'kosztorys-sections',
    data: { investment: investment.id, name: 'Sekcja alfa', displayOrder: 0 },
    ...ctx,
  })

  for (const [displayOrder, description] of ROWS.entries()) {
    const item = await payload.create({
      collection: 'kosztorys-items',
      data: {
        investment: investment.id,
        section: section.id,
        displayOrder,
        description,
        unit: 'm2',
        plannedQty: PLANNED_QTY,
        discountValue: 0,
        clientPrice: CLIENT_PRICE,
      },
      ...ctx,
    })
    // Progress on the FIRST etap only, so the second one is an empty cell the spec can type into and
    // watch the sum move.
    await payload.create({
      collection: 'stage-progress',
      data: { item: item.id, stage: stages[0].id, qtyDone: QTY_DONE },
      ...ctx,
    })
  }

  return investment.id
}

async function main() {
  const payload = await getPayload({ config })
  // The test DB is never reset, so a stable name would collide across runs.
  const stamp = Date.now()

  const seed = {
    live: await seedInvestment(payload, `E2E Grid live ${stamp}`),
    writes: await seedInvestment(payload, `E2E Grid zapis ${stamp}`),
  }

  console.log(`GRID_SEED=${JSON.stringify(seed)}`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
