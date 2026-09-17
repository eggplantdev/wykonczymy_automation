// E2E fixture for the confirm-gated, snapshot-backed deletes (EX-520). Three investments, one per
// delete target (pozycja/sekcja/etap) — each test destroys its rozpiska. Two etapy and two sekcje so
// a wrong delete is visible; targets carry stage progress, which is what makes a delete ask first.
//
// Run: DB_POSTGRES_URL=$DB_POSTGRES_URL_TEST node --env-file=.env --import tsx src/scripts/seed-kosztorys-deletes.ts
// Emits: DELETE_SEED={"item":<id>,"section":<id>,"stage":<id>}
import { getPayload } from 'payload'
import config from '../payload.config'

const ctx = { context: { skipRevalidation: true } }

// Names must not overlap — rows are found by rendered text, so „Pozycja 1" would match „Pozycja 12".
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

  // Explicit plane on both etapy — a plane-less etap locks its quantity column, hiding the delete.
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
    // Progress on both etapy, so deleting one leaves quantities in the other to identify it by.
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
