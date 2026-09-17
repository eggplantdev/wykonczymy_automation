// E2E fixture for EX-472 (editor structure commands). Six investments, one per test — each mutates
// its rozpiska. Shapes are the minimum that keeps each command falsifiable (3 sekcje for moves,
// per-section prace for targeting, non-empty presetAppend). No preset row: it is saved through the
// dialog, since `serializeKosztorysAsPreset` is server-only.
//
// Run: DB_POSTGRES_URL=$DB_POSTGRES_URL_TEST node --env-file=.env --import tsx src/scripts/seed-kosztorys-structure.ts
// Emits: STRUCTURE_SEED={"items":<id>,"sections":<id>,"target":<id>,"presetA":<id>,"presetB":<id>,"presetAppend":<id>}
import { getPayload } from 'payload'
import config from '../payload.config'

const ctx = { context: { skipRevalidation: true } }

// Names must be unique — `hasText` matches substrings, so similar names would collide as one locator.
type ShapeT = { section: string; items: string[] }[]

const ITEM_SHAPE: ShapeT = [
  { section: 'Sekcja alfa', items: ['Praca alfa jeden', 'Praca alfa dwa', 'Praca alfa trzy'] },
  { section: 'Sekcja beta', items: ['Praca beta jeden'] },
]

const SECTION_SHAPE: ShapeT = [
  { section: 'Sekcja wiodąca', items: ['Robota wiodąca'] },
  { section: 'Sekcja środkowa', items: ['Robota środkowa'] },
  { section: 'Sekcja zamykająca', items: ['Robota zamykająca'] },
]

const TARGET_SHAPE: ShapeT = [
  { section: 'Sekcja pierwsza', items: ['Zadanie pierwsze'] },
  { section: 'Sekcja docelowa', items: ['Zadanie docelowe'] },
  { section: 'Sekcja ostatnia', items: ['Zadanie ostatnie'] },
]

const PRESET_A_SHAPE: ShapeT = [
  { section: 'Sekcja szablonu A', items: ['Praca z szablonu A'] },
  { section: 'Sekcja pominięta A', items: ['Praca pominięta A'] },
]

const PRESET_B_SHAPE: ShapeT = [{ section: 'Sekcja szablonu B', items: ['Praca z szablonu B'] }]

const PRESET_APPEND_SHAPE: ShapeT = [{ section: 'Sekcja zastana', items: ['Praca zastana'] }]

async function seedInvestment(
  payload: Awaited<ReturnType<typeof getPayload>>,
  name: string,
  shape: ShapeT,
): Promise<number> {
  const investment = await payload.create({
    collection: 'investments',
    data: { name, status: 'active', vatRate: 0.23, settlementMode: 'NET' },
    ...ctx,
  })

  // displayOrder is global across the rozpiska, not per section — matches what move/insert rewrite.
  let itemOrder = 0
  for (const [sectionOrder, spec] of shape.entries()) {
    const section = await payload.create({
      collection: 'kosztorys-sections',
      data: { investment: investment.id, name: spec.section, displayOrder: sectionOrder },
      ...ctx,
    })
    for (const description of spec.items) {
      await payload.create({
        collection: 'kosztorys-items',
        data: {
          investment: investment.id,
          section: section.id,
          displayOrder: itemOrder++,
          description,
          unit: 'm2',
          plannedQty: 10,
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
    items: await seedInvestment(payload, `E2E Struktura pozycje ${stamp}`, ITEM_SHAPE),
    sections: await seedInvestment(payload, `E2E Struktura sekcje ${stamp}`, SECTION_SHAPE),
    target: await seedInvestment(payload, `E2E Struktura cel ${stamp}`, TARGET_SHAPE),
    presetA: await seedInvestment(payload, `E2E Struktura szablon A ${stamp}`, PRESET_A_SHAPE),
    presetB: await seedInvestment(payload, `E2E Struktura szablon B ${stamp}`, PRESET_B_SHAPE),
    presetAppend: await seedInvestment(
      payload,
      `E2E Struktura doklejenie ${stamp}`,
      PRESET_APPEND_SHAPE,
    ),
  }

  console.log(`STRUCTURE_SEED=${JSON.stringify(seed)}`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
