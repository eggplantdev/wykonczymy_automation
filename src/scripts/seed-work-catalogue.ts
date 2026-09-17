// E2E fixture for the katalog prac round trip (EX-756). Two investments, one per test. Two sekcje
// with prace so a placement claim is falsifiable; one etap with a plane (plane-less locks its
// column); j.m. on every praca, which the katalog requires. Every opis carries the run's timestamp —
// the katalog is global and never reset, so a stable opis would hit overwrite instead of create.
//
// Run: DB_POSTGRES_URL=$DB_POSTGRES_URL_TEST node --env-file=.env --import tsx src/scripts/seed-work-catalogue.ts
// Emits: CATALOGUE_SEED={"save":{...},"insert":{...}}
import { getPayload } from 'payload'
import config from '../payload.config'

const ctx = { context: { skipRevalidation: true, skipSheetSync: true } }

const PLANNED_QTY = 10
const CLIENT_PRICE = 100

const SECTION_ALFA = 'Sekcja alfa'
const SECTION_BETA = 'Sekcja beta'

type SeededInvestmentT = {
  id: number
  // Saved to the katalog by each test; lives in „Sekcja alfa".
  item: string
  // The only praca of „Sekcja beta" — an inserted praca must land behind it.
  beta: string
}

async function seedInvestment(
  payload: Awaited<ReturnType<typeof getPayload>>,
  name: string,
  suffix: string,
): Promise<SeededInvestmentT> {
  const investment = await payload.create({
    collection: 'investments',
    data: { name, status: 'active', vatRate: 0.23, settlementMode: 'NET' },
    ...ctx,
  })

  await payload.create({
    collection: 'kosztorys-stages',
    data: { investment: investment.id, ordinal: 1, label: 'Etap 1', plane: 'w_tools' },
    ...ctx,
  })

  const sections = new Map<string, number>()
  for (const [displayOrder, sectionName] of [SECTION_ALFA, SECTION_BETA].entries()) {
    const section = await payload.create({
      collection: 'kosztorys-sections',
      data: { investment: investment.id, name: sectionName, displayOrder },
      ...ctx,
    })
    sections.set(sectionName, section.id)
  }

  const items = [
    { section: SECTION_ALFA, description: `Praca alfa jeden ${suffix}` },
    { section: SECTION_ALFA, description: `Praca alfa dwa ${suffix}` },
    { section: SECTION_BETA, description: `Praca beta jeden ${suffix}` },
  ]

  for (const [displayOrder, spec] of items.entries()) {
    const sectionId = sections.get(spec.section)
    if (sectionId === undefined) throw new Error(`no seeded section „${spec.section}"`)
    await payload.create({
      collection: 'kosztorys-items',
      data: {
        investment: investment.id,
        section: sectionId,
        displayOrder,
        description: spec.description,
        unit: 'm2',
        plannedQty: PLANNED_QTY,
        discountValue: 0,
        clientPrice: CLIENT_PRICE,
      },
      ...ctx,
    })
  }

  return { id: investment.id, item: items[0].description, beta: items[2].description }
}

async function main() {
  const payload = await getPayload({ config })
  const stamp = Date.now()

  const seed = {
    save: await seedInvestment(payload, `E2E Katalog zapis ${stamp}`, `Z${stamp}`),
    insert: await seedInvestment(payload, `E2E Katalog wstaw ${stamp}`, `W${stamp}`),
  }

  console.log(`CATALOGUE_SEED=${JSON.stringify(seed)}`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
