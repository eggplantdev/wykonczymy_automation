// One-off sync test: seed a realistic multi-etap kosztorys for investment 67
// (Bora Komorowskiego 56, completed) whose executed robocizna equals its real
// LABOR_COST total (151 530), split across sections/etapy. #67 has a CORRECTION
// (−139,97) but no RABAT — correction is a transaction/bilans figure with no
// kosztorys counterpart, so it is NOT modelled here; we only reproduce robocizna.
//   node --env-file=.env --import tsx src/scripts/seed-sync-test-inv67.ts
import { getPayload } from 'payload'
import config from '../payload.config'

const INVESTMENT_ID = 67
const STAGE_COUNT = 6

// cena × Σ(perStage) per item; Σ over all items = 91 618 (LABOR_COST excluding
// the cancelled 59 912 row — only id-91618 is active).
type SeedItemT = {
  section: string
  description: string
  unit: string
  price: number
  perStage: number[]
}
const ITEMS: SeedItemT[] = [
  {
    section: 'Ściany',
    description: 'Gładzie gipsowe',
    unit: 'm2',
    price: 45,
    perStage: [80, 70, 60, 50, 40, 0],
  }, // 300 → 13 500
  {
    section: 'Podłogi',
    description: 'Wylewki samopoziomujące',
    unit: 'm2',
    price: 90,
    perStage: [100, 80, 70, 0, 0, 0],
  }, // 250 → 22 500
  {
    section: 'Podłogi',
    description: 'Układanie paneli',
    unit: 'm2',
    price: 150,
    perStage: [60, 60, 60, 0, 0, 0],
  }, // 180 → 27 000
  {
    section: 'Łazienka',
    description: 'Płytki ścienne i podłogowe',
    unit: 'm2',
    price: 118,
    perStage: [40, 30, 30, 0, 0, 0],
  }, // 100 → 11 800
  {
    section: 'Łazienka',
    description: 'Biały montaż',
    unit: 'szt',
    price: 80,
    perStage: [40, 50, 30, 0, 0, 0],
  }, // 120 → 9 600
  {
    section: 'Hydraulika',
    description: 'Instalacja wod-kan',
    unit: 'pkt',
    price: 120.3,
    perStage: [30, 30, 0, 0, 0, 0],
  }, // 60 → 7 218
]

async function run() {
  const payload = await getPayload({ config })
  const ctx = { context: { skipRevalidation: true } }

  await payload.delete({
    collection: 'kosztorys-sections',
    where: { investment: { equals: INVESTMENT_ID } },
    ...ctx,
  })
  await payload.delete({
    collection: 'kosztorys-stages',
    where: { investment: { equals: INVESTMENT_ID } },
    ...ctx,
  })
  // No global discount on #67.
  await payload.update({
    collection: 'investments',
    id: INVESTMENT_ID,
    // vatRate 0 so the kosztorys figure reads netto — matching the app's netto robocizna.
    data: { globalDiscountType: null, globalDiscountValue: 0, vatRate: 0 },
    ...ctx,
  })

  const stageIds: number[] = []
  for (let ord = 1; ord <= STAGE_COUNT; ord++) {
    const s = await payload.create({
      collection: 'kosztorys-stages',
      data: { investment: INVESTMENT_ID, ordinal: ord },
      ...ctx,
    })
    stageIds.push(s.id)
  }

  const sectionIds = new Map<string, number>()
  let sectionOrder = 0
  const sectionItemOrder = new Map<string, number>()
  let total = 0

  for (const it of ITEMS) {
    if (!sectionIds.has(it.section)) {
      const section = await payload.create({
        collection: 'kosztorys-sections',
        data: {
          investment: INVESTMENT_ID,
          name: it.section,
          displayOrder: sectionOrder++,
          defaultCostVariant: 'w_tools',
        },
        ...ctx,
      })
      sectionIds.set(it.section, section.id)
      sectionItemOrder.set(it.section, 0)
    }
    const sectionId = sectionIds.get(it.section) as number
    const itemOrder = sectionItemOrder.get(it.section) as number
    sectionItemOrder.set(it.section, itemOrder + 1)

    const pomiar = it.perStage.reduce((acc, q) => acc + q, 0)
    total += it.price * pomiar

    const item = await payload.create({
      collection: 'kosztorys-items',
      data: {
        investment: INVESTMENT_ID,
        section: sectionId,
        displayOrder: itemOrder,
        description: it.description,
        unit: it.unit,
        plannedQty: pomiar,
        discountType: null,
        discountValue: 0,
        clientPrice: it.price,
        hiddenInExport: false,
      },
      ...ctx,
    })
    for (let k = 0; k < STAGE_COUNT; k++) {
      if (it.perStage[k] !== 0) {
        await payload.create({
          collection: 'stage-progress',
          data: { item: item.id, stage: stageIds[k], qtyDone: it.perStage[k] },
          ...ctx,
        })
      }
    }
  }

  console.log(
    `Seeded inv ${INVESTMENT_ID}: ${sectionIds.size} sekcji, ${ITEMS.length} pozycji, ${STAGE_COUNT} etapów`,
  )
  console.log(
    `Executed robocizna = ${total} (target 91618), no rabat; CORRECTION -139.97 stays on the investment page`,
  )
  process.exit(0)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
