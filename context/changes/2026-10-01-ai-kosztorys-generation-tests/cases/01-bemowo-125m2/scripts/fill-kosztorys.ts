// One-off for the AI kosztorys test (context/changes/2026-10-01-ai-kosztorys-generation-tests):
// writes the agent's output into investment #167's kosztorys on the LOCAL DB — Przedmiar v2 and its
// source in Komentarz on every rozpiska position, plus the works the szablon lacks as new positions
// (taken from the katalog prac where one fits). Open questions go to the investment notes.
// Items are matched to the szablon #165 rozpiska dump by section + description, because seeding
// from the szablon gave every item a new id. Like create-investment.ts, it runs from src/scripts/:
//   cp <this file> src/scripts/fill-kosztorys-167.ts
//   DRY=1 node --env-file=.env --conditions=react-server --import tsx src/scripts/fill-kosztorys-167.ts
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '../payload.config'

const INVESTMENT_ID = 167
const CASE = path.join(
  import.meta.dirname,
  '../../context/changes/2026-10-01-ai-kosztorys-generation-tests/cases/01-bemowo-125m2',
)
const DRY = process.env.DRY === '1'

type NewWorkT = {
  section: string
  catalogueId: number | null
  description?: string
  unit?: string
  qty: number
  clientPrice?: number
  note: string
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
const readJson = <T>(file: string): T => JSON.parse(readFileSync(path.join(CASE, file), 'utf8'))

async function run() {
  const payload = await getPayload({ config })
  const ctx = { context: { skipRevalidation: true } }

  const rozpiska = new Map<number, { section: string; desc: string }>()
  for (const line of readFileSync(path.join(CASE, 'inputs/rozpiska-szablon-165.txt'), 'utf8').split(
    '\n',
  )) {
    if (!line.trim()) continue
    const [, section, id, desc] = line.split(' | ').map((s) => s.trim())
    rozpiska.set(Number(id), { section: norm(section), desc: norm(desc) })
  }
  const rows = readJson<{ id: number; qty: number; note: string }[]>('measure/przedmiar-v2.json')
  const newWorks = readJson<NewWorkT[]>('measure/new-works.json')

  const { docs: items } = await payload.find({
    collection: 'kosztorys-items',
    where: { investment: { equals: INVESTMENT_ID } },
    depth: 1,
    limit: 2000,
    pagination: false,
  })
  const nonZero = items.filter((i) => i.plannedQty !== 0)
  if (nonZero.length)
    throw new Error(`#${INVESTMENT_ID} already has ${nonZero.length} items with Przedmiar ≠ 0`)

  const byKey = new Map<string, (typeof items)[number][]>()
  for (const item of items) {
    const section = typeof item.section === 'object' ? item.section.name : ''
    const key = `${norm(section)}|${norm(item.description ?? '')}`
    byKey.set(key, [...(byKey.get(key) ?? []), item])
  }

  const updates = rows.map(({ id, qty, note }) => {
    const src = rozpiska.get(id)
    if (!src) throw new Error(`rozpiska has no ${id}`)
    const matches = byKey.get(`${src.section}|${src.desc}`) ?? []
    if (matches.length !== 1)
      throw new Error(`${id} matched ${matches.length} items (${src.section} / ${src.desc})`)
    return { itemId: matches[0].id, qty, note }
  })

  const { docs: sections } = await payload.find({
    collection: 'kosztorys-sections',
    where: { investment: { equals: INVESTMENT_ID } },
    limit: 100,
    pagination: false,
  })
  const creates = await Promise.all(
    newWorks.map(async (work) => {
      const section = sections.find((s) => norm(s.name) === norm(work.section))
      if (!section) throw new Error(`#${INVESTMENT_ID} has no section ${work.section}`)
      const catalogue = work.catalogueId
        ? await payload.findByID({ collection: 'work-catalogue-items', id: work.catalogueId })
        : null
      const lastOrder = Math.max(
        -1,
        ...items
          .filter((i) => (typeof i.section === 'object' ? i.section.id : i.section) === section.id)
          .map((i) => i.displayOrder),
      )
      return {
        investment: INVESTMENT_ID,
        section: section.id,
        displayOrder:
          lastOrder + 1 + newWorks.filter((w) => w.section === work.section).indexOf(work),
        description: catalogue?.description ?? work.description,
        unit: catalogue?.unit ?? work.unit,
        clientPrice: catalogue?.clientPrice ?? work.clientPrice ?? 0,
        wToolsOverrideValue: catalogue?.wToolsRate ?? null,
        ownToolsOverrideValue: catalogue?.ownToolsRate ?? null,
        wToolsOverrideCoeff: catalogue?.wToolsRateCoeff ?? null,
        ownToolsOverrideCoeff: catalogue?.ownToolsRateCoeff ?? null,
        plannedQty: work.qty,
        note: work.note,
      }
    }),
  )
  console.log(
    `${updates.length} items to update, ${creates.length} to add, ${items.length} items in #${INVESTMENT_ID}`,
  )
  if (DRY) process.exit(0)

  for (const u of updates) {
    await payload.update({
      collection: 'kosztorys-items',
      id: u.itemId,
      data: { plannedQty: u.qty, note: u.note },
      ...ctx,
    })
  }
  for (const data of creates) {
    await payload.create({ collection: 'kosztorys-items', data, ...ctx })
  }

  const investment = await payload.findByID({ collection: 'investments', id: INVESTMENT_ID })
  const appendix = readFileSync(path.join(CASE, 'investment-notes-appendix.txt'), 'utf8').trim()
  if (!investment.notes?.includes(appendix.split('\n')[0])) {
    await payload.update({
      collection: 'investments',
      id: INVESTMENT_ID,
      data: { notes: `${investment.notes ?? ''}\n\n${appendix}` },
      ...ctx,
    })
  }
  console.log('done')
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
