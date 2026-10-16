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

  // An explicit plane on both etapy: a plane-less etap renders its quantity column locked.
  const stages = []
  for (const ordinal of [1, 2]) {
    stages.push(
      await payload.create({
        collection: 'kosztorys-stages',
        data: {
          splitMode: 'percent',
          investment: investment.id,
          ordinal,
          label: `Etap ${ordinal}`,
          plane: 'w_tools',
        },
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
