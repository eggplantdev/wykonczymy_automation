// One-off sync test: seed a single lump kosztorys item for investment 14
// (Wołoska 3/302, completed) whose executed robocizna equals its real
// LABOR_COST total, plus a global rabat matching its RABAT transaction. Lets us
// eyeball the kosztorys podsumowanie against the investment page.
//   node --env-file=.env --import tsx src/scripts/seed-sync-test-inv14.ts
import { getPayload } from 'payload'
import config from '../payload.config'

const INVESTMENT_ID = 14
const LABOR_COSTS_TOTAL = 95004 // Σ LABOR_COST excluding cancelled (only id 1114 is active)
const RABAT_AMOUNT = 226.19 // RABAT transaction

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

  await payload.update({
    collection: 'investments',
    id: INVESTMENT_ID,
    // vatRate 0 so the kosztorys figure reads netto — matching the app's netto robocizna.
    data: { globalDiscountType: 'amount', globalDiscountValue: RABAT_AMOUNT, vatRate: 0 },
    ...ctx,
  })

  const stage = await payload.create({
    collection: 'kosztorys-stages',
    data: { investment: INVESTMENT_ID, ordinal: 1 },
    ...ctx,
  })
  const section = await payload.create({
    collection: 'kosztorys-sections',
    data: {
      investment: INVESTMENT_ID,
      name: 'Robocizna (test sync)',
      displayOrder: 0,
      defaultCostVariant: 'w_tools',
    },
    ...ctx,
  })
  const item = await payload.create({
    collection: 'kosztorys-items',
    data: {
      investment: INVESTMENT_ID,
      section: section.id,
      displayOrder: 0,
      description: 'Robocizna łącznie',
      unit: 'kpl',
      plannedQty: 1,
      discountType: null,
      discountValue: 0,
      clientPrice: LABOR_COSTS_TOTAL,
      hiddenInExport: false,
    },
    ...ctx,
  })
  // pomiar z natury = Σ etapów = 1 → executed = 1 × cena = LABOR_COSTS_TOTAL.
  await payload.create({
    collection: 'stage-progress',
    data: { item: item.id, stage: stage.id, qtyDone: 1 },
    ...ctx,
  })

  console.log(
    `Seeded inv ${INVESTMENT_ID}: executed robocizna = ${LABOR_COSTS_TOTAL}, global rabat (amount) = ${RABAT_AMOUNT}`,
  )
  console.log(`Expected „Robocizna do zapłaty" = ${(LABOR_COSTS_TOTAL - RABAT_AMOUNT).toFixed(2)}`)
  process.exit(0)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
