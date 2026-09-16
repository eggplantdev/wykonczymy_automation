// E2E fixture for EX-689 — „Zapisz kolejność": baking the sort showing right now into display_order.
//
// Seeds THREE identical investments through the Payload Local API, one per scenario, because every
// scenario rewrites display_order and a shared rozpiska would make each test depend on the order the
// previous one left behind.
//
// The przedmiary are the point of the shape. They are INTERLEAVED across the two sekcje (alfa 3/1/5,
// beta 2/6/4) and disagree with both the seeded order and the alphabet, so:
//   • a global sort visibly interleaves the two sekcje — with przedmiary grouped by section, the
//     global and the „zachowując sekcje" scope would paint the same picture and the spec would prove
//     nothing about which one ran;
//   • the order after a bake cannot be the seeded one by accident;
//   • filtering to „Alfa" leaves the beta rows in an order that is neither sorted nor seeded, which
//     is what makes „the bake renumbered the hidden rows too" readable off the beta block alone.
//
// Run against the isolated test DB (mirrors e2e/global-setup.ts):
//   DB_POSTGRES_URL=$DB_POSTGRES_URL_TEST node --env-file=.env --import tsx \
//     src/scripts/seed-kosztorys-sort.ts
//
// Emits one machine-readable line the E2E spec parses:
//   SORT_SEED={"bake":<id>,"undo":<id>,"search":<id>}
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

  // displayOrder runs across the WHOLE rozpiska, not per section — the same counter „Zapisz
  // kolejność" rewrites, so seeding it any other way would test a state the app never produces.
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
