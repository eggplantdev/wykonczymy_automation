// E2E fixture for EX-442 (szablony kosztorysu). Two investments: `source` — 2 sekcje with przedmiar
// and stage progress, the per-job fields a szablon must drop; `reload` — one sekcja/praca, replaced
// by „Wczytaj szablon…". No preset row seeded: `serializeKosztorysAsPreset` is server-only.
//
// Run: DB_POSTGRES_URL=$DB_POSTGRES_URL_TEST node --env-file=.env --import tsx src/scripts/seed-kosztorys-presets.ts
// Emits: PRESET_SEED={"source":<id>,"reload":<id>}
import { getPayload } from 'payload'
import config from '../payload.config'

const ctx = { context: { skipRevalidation: true } }

type ShapeT = { section: string; items: string[] }[]

// Names must be unique — `hasText` matches substrings, so a shared prefix would be one locator.
const SOURCE_SHAPE: ShapeT = [
  { section: 'Sekcja szablonowa', items: ['Praca szablonowa jeden', 'Praca szablonowa dwa'] },
  { section: 'Sekcja pomocnicza', items: ['Praca pomocnicza'] },
]

const RELOAD_SHAPE: ShapeT = [{ section: 'Sekcja zastępowana', items: ['Praca do zastąpienia'] }]

const PLANNED_QTY = 10
const QTY_DONE = 2

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

  // Explicit plane — a plane-less etap locks its quantity column, and this one must hold a figure.
  const stage = await payload.create({
    collection: 'kosztorys-stages',
    data: { investment: investment.id, ordinal: 1, label: 'Etap 1', plane: 'w_tools' },
    ...ctx,
  })

  // displayOrder is global across the rozpiska, not per section — matches what the editor rewrites.
  let itemOrder = 0
  for (const [sectionOrder, spec] of shape.entries()) {
    const section = await payload.create({
      collection: 'kosztorys-sections',
      data: { investment: investment.id, name: spec.section, displayOrder: sectionOrder },
      ...ctx,
    })
    for (const description of spec.items) {
      const item = await payload.create({
        collection: 'kosztorys-items',
        data: {
          investment: investment.id,
          section: section.id,
          displayOrder: itemOrder++,
          description,
          unit: 'm2',
          plannedQty: PLANNED_QTY,
          discountValue: 0,
          clientPrice: 100,
        },
        ...ctx,
      })
      await payload.create({
        collection: 'stage-progress',
        data: { item: item.id, stage: stage.id, qtyDone: QTY_DONE },
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
    source: await seedInvestment(payload, `E2E Szablon źródło ${stamp}`, SOURCE_SHAPE),
    reload: await seedInvestment(payload, `E2E Szablon cel ${stamp}`, RELOAD_SHAPE),
  }

  console.log(`PRESET_SEED=${JSON.stringify(seed)}`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
