// Loads an agent's przedmiar draft into a LOCAL investment's kosztorys as AI przedmiar, so it can be
// reviewed in the editor. Every pozycja gets a value — the draft's qty where sekcja + opis match
// (folded like the sheet import's, so case, diacritics and known typos don't break a match), else 0 (the agent left it out) — and its Status and Powód zmiany are reset.
// A draft row matching no pozycja is a praca the agent added beyond the kosztorys: it becomes a new
// pozycja in its sekcja with Przedmiar 0, so the review shows it as an offer awaiting a verdict.
//
//   INV=<id> DRAFT=<path.json> node --env-file=.env --conditions=react-server --import tsx src/scripts/load-ai-draft.ts
//
// DRAFT: [{ "section": "Łazienka", "description": "Skucie płytek", "qty": 12.5, "unit": "m2", "clientPrice": 80 }, …]
// (`unit` and `clientPrice` are read only for an added pozycja)
import { readFileSync } from 'node:fs'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { sectionItemKey } from '@/lib/kosztorys/sheet-import/item-key'
import { assertLocalDb } from '@/scripts/assert-local-db'

type DraftRowT = {
  section: string
  description: string
  qty: number
  unit?: string
  clientPrice?: number
}

const INVESTMENT_ID = Number(process.env.INV)
const DRAFT = process.env.DRAFT
if (!INVESTMENT_ID || !DRAFT) throw new Error('Set INV=<local investment id> and DRAFT=<path.json>')
assertLocalDb('load-ai-draft')

async function run() {
  const draft: DraftRowT[] = JSON.parse(readFileSync(DRAFT as string, 'utf8'))
  const qtyByKey = new Map(
    draft.map((row) => [sectionItemKey(row.section, row.description), row.qty]),
  )

  const payload = await getPayload({ config })
  const { docs: items } = await payload.find({
    collection: 'kosztorys-items',
    where: { investment: { equals: INVESTMENT_ID } },
    depth: 1,
    limit: 5000,
    pagination: false,
  })

  const matchedKeys = new Set<string>()
  const lastOrderBySection = new Map<number, number>()
  for (const item of items) {
    const section = typeof item.section === 'object' ? item.section : undefined
    const key = sectionItemKey(section?.name ?? '', item.description ?? null)
    const qty = qtyByKey.get(key)
    if (qty !== undefined) matchedKeys.add(key)
    if (section) {
      const last = lastOrderBySection.get(section.id) ?? 0
      lastOrderBySection.set(section.id, Math.max(last, item.displayOrder))
    }
    await payload.update({
      collection: 'kosztorys-items',
      id: item.id,
      data: { aiPlannedQty: qty ?? 0, reviewStatus: null, changeReason: null },
      context: { skipRevalidation: true },
    })
  }

  const { docs: sections } = await payload.find({
    collection: 'kosztorys-sections',
    where: { investment: { equals: INVESTMENT_ID } },
    limit: 500,
    pagination: false,
  })
  const sectionByKey = new Map(
    sections.map((section) => [sectionItemKey(section.name, null), section]),
  )

  let added = 0
  const withoutSection: DraftRowT[] = []
  for (const row of draft) {
    if (matchedKeys.has(sectionItemKey(row.section, row.description))) continue
    const section = sectionByKey.get(sectionItemKey(row.section, null))
    if (!section) {
      withoutSection.push(row)
      continue
    }
    const displayOrder = (lastOrderBySection.get(section.id) ?? 0) + 1
    lastOrderBySection.set(section.id, displayOrder)
    await payload.create({
      collection: 'kosztorys-items',
      data: {
        investment: INVESTMENT_ID,
        section: section.id,
        displayOrder,
        description: row.description,
        unit: row.unit,
        clientPrice: row.clientPrice ?? 0,
        plannedQty: 0,
        discountValue: 0,
        aiPlannedQty: row.qty,
      },
      context: { skipRevalidation: true },
    })
    added++
  }

  console.log(
    `#${INVESTMENT_ID}: ${items.length} pozycji, ${matchedKeys.size}/${draft.length} wierszy szkicu dopasowanych, ${added} dodanych`,
  )
  for (const row of withoutSection) console.log(`brak sekcji: ${row.section} | ${row.description}`)
  process.exit(0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
