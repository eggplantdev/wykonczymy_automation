// E2E fixture for EX-442 — szablony kosztorysu: „Zapisz jako szablon…", seeding a new investment
// from one on the create form, and „Wczytaj szablon…" over a rozpiska that already exists.
//
// Seeds TWO fresh investments through the Payload Local API. No preset row is seeded here on
// purpose: `serializeKosztorysAsPreset` is `server-only` and hand-writing its jsonb payload would
// pin this fixture to the snapshot format's column list. The spec saves the szablon through the
// real dialog instead, which is scenario 1 anyway — so the library the later scenarios read is the
// one the app itself wrote.
//
//   • `source` — the kosztorys the szablon is cut from. Two sekcje deep so an investment seeded
//     from it proves the whole skeleton crossed over and not just the first band, and every praca
//     carries przedmiar AND recorded progress on an etap: both are per-job fields a szablon must
//     drop, and neither absence is provable against a fixture that never had them.
//   • `reload` — the rozpiska „Wczytaj szablon…" replaces. Its own names, so „the szablon's prace
//     are on screen" cannot be satisfied by what was there before; one sekcja/one praca, because
//     the dialog states what disappears and a one-row count is the one that cannot be read as the
//     szablon's own.
//
// Run against the isolated test DB (mirrors e2e/global-setup.ts):
//   DB_POSTGRES_URL=$DB_POSTGRES_URL_TEST node --env-file=.env --import tsx \
//     src/scripts/seed-kosztorys-presets.ts
//
// Emits one machine-readable line the E2E spec parses:
//   PRESET_SEED={"source":<id>,"reload":<id>}
import { getPayload } from 'payload'
import config from '../payload.config'

const ctx = { context: { skipRevalidation: true } }

type ShapeT = { section: string; items: string[] }[]

// Every name is unique across the fixture: the spec finds rows by rendered text and `hasText`
// matches substrings, so two names sharing a prefix would be one locator.
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

  // An explicit plane: a plane-less etap renders its quantity column locked, and the point of the
  // etap here is that it holds a figure a szablon then leaves behind.
  const stage = await payload.create({
    collection: 'kosztorys-stages',
    data: { investment: investment.id, ordinal: 1, label: 'Etap 1', plane: 'w_tools' },
    ...ctx,
  })

  // displayOrder runs across the WHOLE rozpiska, not per section — the same counter the editor
  // rewrites, so seeding it any other way would test a state the app never produces.
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
