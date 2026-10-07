// Loads an agent's przedmiar draft into a LOCAL investment's kosztorys as AI przedmiar, so it can be
// reviewed in the editor. Every pozycja gets a value — the draft's qty where sekcja + opis match,
// else 0 (the agent left it out) — and its Status and Powód zmiany are reset.
//
//   INV=<id> DRAFT=<path.json> node --env-file=.env --conditions=react-server --import tsx src/scripts/load-ai-draft.ts
//
// DRAFT: [{ "section": "Łazienka", "description": "Skucie płytek", "qty": 12.5 }, …]
import { readFileSync } from 'node:fs'
import { getPayload } from 'payload'
import config from '@/payload.config'

type DraftRowT = { section: string; description: string; qty: number }

const INVESTMENT_ID = Number(process.env.INV)
const DRAFT = process.env.DRAFT
if (!INVESTMENT_ID || !DRAFT) throw new Error('Set INV=<local investment id> and DRAFT=<path.json>')
if (/neon\.tech/.test(process.env.DB_POSTGRES_URL ?? '')) {
  throw new Error('DB_POSTGRES_URL points at Neon — local DB only')
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
const keyOf = (section: string, description: string) => `${norm(section)}|${norm(description)}`

async function run() {
  const draft: DraftRowT[] = JSON.parse(readFileSync(DRAFT as string, 'utf8'))
  const qtyByKey = new Map(draft.map((row) => [keyOf(row.section, row.description), row.qty]))

  const payload = await getPayload({ config })
  const { docs: items } = await payload.find({
    collection: 'kosztorys-items',
    where: { investment: { equals: INVESTMENT_ID } },
    depth: 1,
    limit: 5000,
    pagination: false,
  })

  let matched = 0
  for (const item of items) {
    const section = typeof item.section === 'object' ? item.section.name : ''
    const qty = qtyByKey.get(keyOf(section, item.description ?? ''))
    if (qty !== undefined) matched++
    await payload.update({
      collection: 'kosztorys-items',
      id: item.id,
      data: { aiPlannedQty: qty ?? 0, reviewStatus: null, changeReason: null },
      context: { skipRevalidation: true },
    })
  }
  console.log(
    `#${INVESTMENT_ID}: ${items.length} pozycji, ${matched}/${draft.length} wierszy szkicu dopasowanych`,
  )
  process.exit(0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
