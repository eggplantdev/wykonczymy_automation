// E2E fixture for the katalog prac round trip (EX-756) — saving a praca out of a rozpiska and
// pulling one back into a different sekcja.
//
// Seeds TWO fresh investments, one per test, because the first test overwrites the katalog entry it
// created and the second inserts a praca into its rozpiska — sharing one would make each test read
// what the other left behind.
//
// The shape is the smallest one in which both facts are provable:
//   • TWO sekcje with prace in each, so „wstawiona praca wylądowała na końcu właściwej sekcji" is a
//     statement the grid can contradict — with one sekcja every placement is the right placement;
//   • one etap with a plane, because a plane-less etap renders its column locked;
//   • j.m. on every praca, since the katalog refuses a praca without one.
//
// Every opis carries the run's timestamp. The katalog is GLOBAL and the test DB is never reset, so a
// stable opis would make the second run's first save hit the overwrite branch that the first run
// created — and the test asserts it takes the create branch.
//
// Run against the isolated test DB (mirrors e2e/global-setup.ts):
//   DB_POSTGRES_URL=$DB_POSTGRES_URL_TEST node --env-file=.env --import tsx \
//     src/scripts/seed-work-catalogue.ts
//
// Emits one machine-readable line the spec parses:
//   CATALOGUE_SEED={"save":{...},"insert":{...}}
import { getPayload } from 'payload'
import config from '../payload.config'

const ctx = { context: { skipRevalidation: true, skipSheetSync: true } }

const PLANNED_QTY = 10
const CLIENT_PRICE = 100

const SECTION_ALFA = 'Sekcja alfa'
const SECTION_BETA = 'Sekcja beta'

type SeededInvestmentT = {
  id: number
  // The praca each test saves to the katalog, in „Sekcja alfa".
  item: string
  // The only praca of „Sekcja beta" — the one an inserted praca has to land BEHIND.
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
