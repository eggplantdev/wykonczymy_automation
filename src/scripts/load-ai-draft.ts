// Loads an agent's przedmiar draft into a LOCAL investment's kosztorys as AI przedmiar, so it can be
// reviewed in the editor. Every pozycja gets a value — the draft's qty where sekcja + opis match
// (folded like the sheet import's, so case, diacritics and known typos don't break a match), else 0
// (the agent left it out) — and its Komentarz AI is replaced. Status and Powód zmiany are the owner's,
// so the loader never writes them.
// A draft row matching no pozycja is a praca the agent added beyond the kosztorys: it becomes a new
// pozycja in its sekcja with Przedmiar 0, so the review shows it as an offer awaiting a verdict. A
// draft row whose sekcja is missing stops the run before any write.
// The investment's Etap AI is set to „Przeanalizowana”.
//
//   INV=<id> DRAFT=<path.json> node --env-file=.env --conditions=react-server --import tsx src/scripts/load-ai-draft.ts
//
// DRAFT: [{ "section": "Łazienka", "description": "Skucie płytek", "qty": 12.5, "unit": "m2", "clientPrice": 80,
//           "missingData": "wysokość pomieszczeń", "assumptions": "2,75 m" }, …]
// (`unit` and `clientPrice` are read only for an added pozycja. `missingData` / `assumptions` are
// Komentarz AI — never Komentarz, which the investor may be shown; the loader writes no Komentarz.)
//
// ROUND=<N ≥ 2> loads a later round (EX-1057) instead. Only the pozycje the draft names are touched:
// a matched one gets the new AI przedmiar, its „Runda N — …” block appended to „Nowe informacje” and
// the „Do ponownego sprawdzenia” flag — its Komentarz AI stays; an unmatched row becomes a new
// pozycja (Przedmiar 0) with the block and the flag; every pozycja the draft leaves out keeps
// everything. Each row carries `"newInformation": "Runda N — …"`, and a round already loaded on any
// pozycja is refused before anything is written.
import { readFileSync } from 'node:fs'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { appendRoundBlock, assertRoundDraft, hasRoundBlock } from '@/lib/kosztorys/ai-round'
import { sectionItemKey } from '@/lib/kosztorys/sheet-import/item-key'
import { assertLocalDb } from '@/scripts/assert-local-db'

type DraftRowT = {
  section: string
  description: string
  qty: number
  unit?: string
  clientPrice?: number
  missingData?: string
  assumptions?: string
  newInformation?: string
}

const ROUND = process.env.ROUND ? Number(process.env.ROUND) : undefined
const INVESTMENT_ID = Number(process.env.INV)
const DRAFT = process.env.DRAFT
if (!INVESTMENT_ID || !DRAFT) throw new Error('Set INV=<local investment id> and DRAFT=<path.json>')
assertLocalDb('load-ai-draft')

async function run() {
  const draft: DraftRowT[] = JSON.parse(readFileSync(DRAFT as string, 'utf8'))
  if (ROUND !== undefined) assertRoundDraft(draft, ROUND)
  const rowByKey = new Map(draft.map((row) => [sectionItemKey(row.section, row.description), row]))

  const payload = await getPayload({ config })
  const { docs: items } = await payload.find({
    collection: 'kosztorys-items',
    where: { investment: { equals: INVESTMENT_ID } },
    depth: 1,
    limit: 5000,
    pagination: false,
  })
  if (ROUND !== undefined) {
    const loaded = items.filter((item) => hasRoundBlock(item.aiNewInformation, ROUND))
    if (loaded.length) throw new Error(`Runda ${ROUND} is already on ${loaded.length} pozycji`)
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
  // Checked before the first write: a round half-loaded can't be re-run, its guard refuses it.
  const itemKeys = new Set(
    items.map((item) =>
      sectionItemKey(
        typeof item.section === 'object' ? item.section.name : '',
        item.description ?? null,
      ),
    ),
  )
  const withoutSection = draft.filter(
    (row) =>
      !itemKeys.has(sectionItemKey(row.section, row.description)) &&
      !sectionByKey.has(sectionItemKey(row.section, null)),
  )
  if (withoutSection.length) {
    throw new Error(
      `no sekcja for: ${withoutSection.map((row) => `${row.section} | ${row.description}`).join('; ')}`,
    )
  }

  const matchedKeys = new Set<string>()
  const lastOrderBySection = new Map<number, number>()
  for (const item of items) {
    const section = typeof item.section === 'object' ? item.section : undefined
    const key = sectionItemKey(section?.name ?? '', item.description ?? null)
    const row = rowByKey.get(key)
    if (row) matchedKeys.add(key)
    if (section) {
      const last = lastOrderBySection.get(section.id) ?? 0
      lastOrderBySection.set(section.id, Math.max(last, item.displayOrder))
    }
    if (ROUND !== undefined) {
      if (!row) continue
      await payload.update({
        collection: 'kosztorys-items',
        id: item.id,
        data: {
          aiPlannedQty: row.qty,
          aiNewInformation: appendRoundBlock(
            item.aiNewInformation ?? null,
            row.newInformation ?? '',
          ),
          aiRecheck: true,
        },
        context: { skipRevalidation: true },
      })
      continue
    }
    await payload.update({
      collection: 'kosztorys-items',
      id: item.id,
      data: {
        aiPlannedQty: row?.qty ?? 0,
        aiMissingData: row?.missingData ?? null,
        aiAssumptions: row?.assumptions ?? null,
      },
      context: { skipRevalidation: true },
    })
  }

  let added = 0
  for (const row of draft) {
    if (matchedKeys.has(sectionItemKey(row.section, row.description))) continue
    const section = sectionByKey.get(sectionItemKey(row.section, null))
    if (!section) continue
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
        ...(ROUND === undefined
          ? { aiMissingData: row.missingData ?? null, aiAssumptions: row.assumptions ?? null }
          : { aiNewInformation: row.newInformation, aiRecheck: true }),
      },
      context: { skipRevalidation: true },
    })
    added++
  }

  // The listing reads „Analiza AI” off the stored stage alone.
  await payload.update({
    collection: 'investments',
    id: INVESTMENT_ID,
    data: { aiStage: 'analyzed' },
    context: { skipRevalidation: true },
  })

  console.log(
    `#${INVESTMENT_ID}: ${items.length} pozycji, ${matchedKeys.size}/${draft.length} wierszy szkicu dopasowanych, ${added} dodanych`,
  )
  process.exit(0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
