import { getPayload } from 'payload'
import config from '../payload.config'

const ctx = { context: { skipRevalidation: true } }

// In seeded display order, which is deliberately not the sorted one.
const SHAPE: { section: string; items: { description: string; plannedQty: number }[] }[] = [
  {
    section: 'Sekcja alfa',
    items: [
      { description: 'Alfa jeden', plannedQty: 3 },
      { description: 'Alfa dwa', plannedQty: 1 },
      { description: 'Alfa trzy', plannedQty: 5 },
    ],
  },
  {
    section: 'Sekcja beta',
    items: [
      { description: 'Beta jeden', plannedQty: 2 },
      { description: 'Beta dwa', plannedQty: 6 },
      { description: 'Beta trzy', plannedQty: 4 },
    ],
  },
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

  let itemOrder = 0
  for (const [sectionOrder, spec] of SHAPE.entries()) {
    const section = await payload.create({
      collection: 'kosztorys-sections',
      data: { investment: investment.id, name: spec.section, displayOrder: sectionOrder },
      ...ctx,
    })
    for (const item of spec.items) {
      await payload.create({
        collection: 'kosztorys-items',
        data: {
          investment: investment.id,
          section: section.id,
          displayOrder: itemOrder++,
          description: item.description,
          unit: 'm2',
          plannedQty: item.plannedQty,
          discountValue: 0,
          clientPrice: 100,
        },
        ...ctx,
      })
    }
  }

  return investment.id
}

async function main() {
  const payload = await getPayload({ config })
  // The test DB is never reset, so a stable name would collide across runs.
  const stamp = Date.now()

  const seed = {
    bake: await seedInvestment(payload, `E2E Sortowanie zapis ${stamp}`),
    undo: await seedInvestment(payload, `E2E Sortowanie cofnięcie ${stamp}`),
    search: await seedInvestment(payload, `E2E Sortowanie fraza ${stamp}`),
  }

  console.log(`SORT_SEED=${JSON.stringify(seed)}`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
