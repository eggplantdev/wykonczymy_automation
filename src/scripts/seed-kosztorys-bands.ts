import { getPayload } from 'payload'
import config from '../payload.config'

const ITEMS_PER_SECTION = 2
const CLIENT_PRICE = 100
const QTY_DONE = 3
const SECTION_NET = CLIENT_PRICE * QTY_DONE * ITEMS_PER_SECTION

const ctx = { context: { skipRevalidation: true } }

async function main() {
  const payload = await getPayload({ config })
  // The test DB is not reset between runs, so a stable name would collide.
  const stamp = Date.now()

  const investment = await payload.create({
    collection: 'investments',
    data: { name: `E2E Bands ${stamp}`, status: 'active', vatRate: 0.23, settlementMode: 'NET' },
    ...ctx,
  })
  const stage = await payload.create({
    collection: 'kosztorys-stages',
    data: { splitMode: 'percent', investment: investment.id, ordinal: 1, label: 'Etap 1' },
    ...ctx,
  })

  const names = [`Fundamenty ${stamp}`, `Ściany ${stamp}`, `Dach ${stamp}`]
  for (const [index, name] of names.entries()) {
    const section = await payload.create({
      collection: 'kosztorys-sections',
      data: {
        investment: investment.id,
        name,
        displayOrder: index,
      },
      ...ctx,
    })
    for (let i = 0; i < ITEMS_PER_SECTION; i++) {
      const item = await payload.create({
        collection: 'kosztorys-items',
        data: {
          investment: investment.id,
          section: section.id,
          displayOrder: i,
          description: `${name} — pozycja ${i + 1}`,
          unit: 'm2',
          plannedQty: 10,
          discountValue: 0,
          clientPrice: CLIENT_PRICE,
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

  console.log(
    `BANDS_SEED=${JSON.stringify({
      investment: investment.id,
      investmentName: investment.name,
      clientPrice: CLIENT_PRICE,
      sections: names.map((name) => ({ name, net: SECTION_NET, itemCount: ITEMS_PER_SECTION })),
    })}`,
  )
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
