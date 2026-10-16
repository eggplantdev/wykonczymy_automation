import { getPayload } from 'payload'
import config from '../payload.config'
import { sectionColorForIndex } from '../lib/kosztorys/section-colors'

const INVESTMENT_ID = Number(process.env.INV ?? 7)
const SECTIONS = 10
const ITEMS_PER_SECTION = 100
const STAGE_COUNT = 7
const CHUNK = 40 // równoległe create() w paczkach, żeby nie zalać puli połączeń

const ctx = { context: { skipRevalidation: true } }

async function run() {
  const payload = await getPayload({ config })

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

  const stageIds: number[] = []
  for (let ord = 1; ord <= STAGE_COUNT; ord++) {
    const s = await payload.create({
      collection: 'kosztorys-stages',
      // with every etap unsettled the whole kosztorys reads as „marża rzeczywista nieznana"
      data: {
        splitMode: 'percent',
        investment: INVESTMENT_ID,
        ordinal: ord,
        plane: ord % 2 === 0 ? 'own_tools' : 'w_tools',
      },
      ...ctx,
    })
    stageIds.push(s.id)
  }

  let itemCount = 0
  let progressCount = 0

  for (let si = 0; si < SECTIONS; si++) {
    const section = await payload.create({
      collection: 'kosztorys-sections',
      data: {
        investment: INVESTMENT_ID,
        name: `Sekcja ${si + 1}`,
        displayOrder: si,
        color: sectionColorForIndex(si),
      },
      ...ctx,
    })

    const indices = Array.from({ length: ITEMS_PER_SECTION }, (_, i) => i)
    for (let c = 0; c < indices.length; c += CHUNK) {
      const slice = indices.slice(c, c + CHUNK)
      const items = await Promise.all(
        slice.map((i) =>
          payload.create({
            collection: 'kosztorys-items',
            data: {
              investment: INVESTMENT_ID,
              section: section.id,
              displayOrder: i,
              description: `Pozycja ${si + 1}.${i + 1} — robocizna testowa`,
              unit: ['m2', 'mb', 'szt', 'kpl'][i % 4],
              plannedQty: (i % 17) + 1,
              discountType: i % 5 === 0 ? 'percent' : null,
              discountValue: i % 5 === 0 ? 5 : 0,
              clientPrice: 20 + (i % 50) * 3,
              wToolsOverrideValue: i % 5 === 0 ? 700 : null,
              ownToolsOverrideValue: null,
            },
            ...ctx,
          }),
        ),
      )
      itemCount += items.length

      // „Pomiar z natury" = Σ etapów, więc każda pozycja dostaje wpis w 1. etapie;
      const progress = items.flatMap((item, idx) => {
        const localIndex = c + idx
        const entries = [{ item: item.id, stage: stageIds[0], qtyDone: (localIndex % 13) + 1 }]
        if (localIndex % 3 === 0) entries.push({ item: item.id, stage: stageIds[1], qtyDone: 1 })
        return entries
      })
      await Promise.all(
        progress.map((data) => payload.create({ collection: 'stage-progress', data, ...ctx })),
      )
      progressCount += progress.length
    }
  }

  console.log(
    `PERF seed inv ${INVESTMENT_ID}: ${SECTIONS} sekcji, ${itemCount} pozycji, ${STAGE_COUNT} etapów, ${progressCount} wpisów postępu`,
  )
  process.exit(0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
