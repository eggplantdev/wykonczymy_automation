// E2E fixture for EX-472 — the editor's structure commands (⋯ on a praca, ⋯ on a section band,
// „Dodaj → Praca", „Dodaj → Sekcja z szablonu…"). Seeds SIX fresh investments through the Payload Local API, one per test,
// because every test here MUTATES the rozpiska's structure: sharing one would make each test read
// whatever the previous one left behind, and a failure would point at the wrong command.
//
// The shapes differ per target, and each is the smallest one in which its command is provable:
//   • `items`   — one sekcja three prace deep, so „Wstaw powyżej/poniżej" has a middle to land in
//                 and a delete has a neighbour on both sides; a second sekcja proves the insert did
//                 not leak across the band.
//   • `sections`— THREE sekcje, which is the smallest count where „Przesuń w górę/dół" has a live
//                 middle AND two dead ends to assert: at two sekcje every move is an edge case.
//   • `target`  — three sekcje with per-section prace, so „Dodaj → Praca → <sekcja>" can pick one
//                 that is neither the first nor the last; a praca landing „somewhere" would still
//                 pass against a two-section fixture.
//   • `presetA` / `presetB` — the two kosztorysy the spec cuts two szablony from. No preset row is
//                 seeded here: `serializeKosztorysAsPreset` is `server-only` and hand-writing its
//                 jsonb would pin this fixture to the snapshot format's column list, so the spec
//                 saves both through the real dialog. Two sekcje in A, one in B — the picker's
//                 selection is cumulative across szablony AND within one, and a szablon holding a
//                 single sekcja could not tell „the wrong sekcja was taken" from „the right one was".
//   • `presetAppend`— the rozpiska the sekcje are appended TO. Non-empty on purpose: they attach at
//                 the tail, and an empty target cannot show the difference between a tail and a
//                 wipe.
//
// No etapy and no recorded progress on purpose: these tests assert ORDER, and a stage column only
// widens the grid that a spec then has to scroll past to reach the „Akcje" cell.
//
// Run against the isolated test DB (mirrors e2e/global-setup.ts):
//   DB_POSTGRES_URL=$DB_POSTGRES_URL_TEST node --env-file=.env --import tsx \
//     src/scripts/seed-kosztorys-structure.ts
//
// Emits one machine-readable line the E2E spec parses:
//   STRUCTURE_SEED={"items":<id>,"sections":<id>,"target":<id>,"presetA":<id>,"presetB":<id>,
//                   "presetAppend":<id>}
import { getPayload } from 'payload'
import config from '../payload.config'

const ctx = { context: { skipRevalidation: true } }

// Every name below is unique across the whole fixture, because the spec finds rows by rendered text
// and `hasText` matches substrings — „Sekcja jeden" and „Praca jeden" would be one locator.
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

  // displayOrder runs across the WHOLE rozpiska, not per section — the same counter the move and
  // insert commands rewrite, so seeding it any other way would test a state the app never produces.
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
