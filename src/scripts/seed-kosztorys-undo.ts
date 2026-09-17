// E2E fixture for EX-525 (cofnij/ponów w edytorze). Four investments, one per scenario — the undo
// stack is per page load, the rows are not. One sekcja, three prace, so ▲▼ has a row with neighbours
// on both sides; every przedmiar is distinct so a reverted value can't be read off a neighbour.
//
// Run: DB_POSTGRES_URL=$DB_POSTGRES_URL_TEST node --env-file=.env --import tsx src/scripts/seed-kosztorys-undo.ts
// Emits: UNDO_SEED={"cell":<id>,"burst":<id>,"boundary":<id>,"reorder":<id>}
import { getPayload } from 'payload'
import config from '../payload.config'

const ctx = { context: { skipRevalidation: true } }

const SECTION = 'Sekcja cofania'
const ITEMS = [
  { description: 'Praca pierwsza', plannedQty: 11 },
  { description: 'Praca druga', plannedQty: 22 },
  { description: 'Praca trzecia', plannedQty: 33 },
]

async function seedInvestment(
  payload: Awaited<ReturnType<typeof getPayload>>,
  name: string,
): Promise<number> {
  const investment = await payload.create({
    collection: 'investments',
    data: { name, status: 'active', vatRate: 0.23, settlementMode: 'NET' },
    ...ctx,
  })

  const section = await payload.create({
    collection: 'kosztorys-sections',
    data: { investment: investment.id, name: SECTION, displayOrder: 0 },
    ...ctx,
  })

  for (const [displayOrder, item] of ITEMS.entries()) {
    await payload.create({
      collection: 'kosztorys-items',
      data: {
        investment: investment.id,
        section: section.id,
        displayOrder,
        description: item.description,
        unit: 'm2',
        plannedQty: item.plannedQty,
        discountValue: 0,
        clientPrice: 100,
      },
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
    cell: await seedInvestment(payload, `E2E Cofanie komórka ${stamp}`),
    burst: await seedInvestment(payload, `E2E Cofanie seria ${stamp}`),
    boundary: await seedInvestment(payload, `E2E Cofanie granica ${stamp}`),
    reorder: await seedInvestment(payload, `E2E Cofanie kolejność ${stamp}`),
  }

  console.log(`UNDO_SEED=${JSON.stringify(seed)}`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
