// E2E fixture for the confirm-gated, snapshot-backed deletes (EX-520). Seeds THREE fresh
// investments through the Payload Local API, one per delete target — pozycja, sekcja, etap — because
// each test destroys part of its rozpiska and would otherwise inherit the previous test's wreckage.
//
// Every investment gets the same shape, which is the smallest one in which each delete is provable:
//   • two etapy, so dropping one leaves a column behind to compare against;
//   • two sekcje, so a cascade delete leaves a sekcja behind — „the grid is empty" would pass even
//     if the wrong thing vanished;
//   • the deleted targets carry recorded stage progress, which is what makes a delete ask first.
//
// Run against the isolated test DB (mirrors e2e/global-setup.ts):
//   DB_POSTGRES_URL=$DB_POSTGRES_URL_TEST node --env-file=.env --import tsx \
//     src/scripts/seed-kosztorys-deletes.ts
//
// Emits one machine-readable line the E2E spec parses:
//   DELETE_SEED={"item":<id>,"section":<id>,"stage":<id>}
import { getPayload } from 'payload'
import config from '../payload.config'

const ctx = { context: { skipRevalidation: true } }

// Distinct enough that a substring match on one never hits another — the spec finds rows by their
// rendered text, and „Pozycja 1" / „Pozycja 12" would be the same locator.
const SECTION_ALFA = 'Sekcja alfa'
const SECTION_BETA = 'Sekcja beta'
const ITEMS = [
  { section: SECTION_ALFA, description: 'Praca alfa jeden' },
  { section: SECTION_ALFA, description: 'Praca alfa dwa' },
  { section: SECTION_BETA, description: 'Praca beta jeden' },
] as const

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
  // locked column cannot show that a delete took its wpisane ilości with it.
  const stages = []
  for (const ordinal of [1, 2]) {
    stages.push(
      await payload.create({
        collection: 'kosztorys-stages',
        data: {
          investment: investment.id,
          ordinal,
          label: `Etap ${ordinal}`,
          plane: 'w_tools',
        },
        ...ctx,
      }),
    )
  }

  const sections = new Map<string, number>()
  for (const [displayOrder, name] of [SECTION_ALFA, SECTION_BETA].entries()) {
    const section = await payload.create({
      collection: 'kosztorys-sections',
      data: { investment: investment.id, name, displayOrder },
      ...ctx,
    })
    sections.set(name, section.id)
  }

  for (const [displayOrder, spec] of ITEMS.entries()) {
    const sectionId = sections.get(spec.section)
    if (sectionId === undefined) throw new Error(`no seeded section „${spec.section}"`)
    const item = await payload.create({
      collection: 'kosztorys-items',
      data: {
        investment: investment.id,
        section: sectionId,
        displayOrder,
        description: spec.description,
        unit: 'm2',
        plannedQty: 10,
        discountValue: 0,
        clientPrice: 100,
      },
      ...ctx,
    })
    // Progress on BOTH etapy, so deleting either one still leaves the other with quantities and the
    // spec can say which column went.
    for (const stage of stages) {
      await payload.create({
        collection: 'stage-progress',
        data: { item: item.id, stage: stage.id, qtyDone: 2 },
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
    item: await seedInvestment(payload, `E2E Delete pozycja ${stamp}`),
    section: await seedInvestment(payload, `E2E Delete sekcja ${stamp}`),
    stage: await seedInvestment(payload, `E2E Delete etap ${stamp}`),
  }

  console.log(`DELETE_SEED=${JSON.stringify(seed)}`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
