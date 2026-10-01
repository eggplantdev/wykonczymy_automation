// Step 2 of a case on PRODUCTION: writes the agent's result into the investment `new-case-prod.ts`
// created — Przedmiar + Komentarz on the szablon positions, the new works appended to their sections,
// and the notes appendix added to the investment's notes. Everything it needs is in `cases/<CASE>/case.json`.
//   TOKEN_FILE=… CASE=02-<slug> [DRY=1] [SKIP_ROWS=1] \
//     node --import tsx context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/fill-case-prod.ts
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { api, BASE, callAction, itemsOf, keyed, norm, resolveActions } from './prod-client'

type CaseT = {
  investmentId: number
  presetId: number
  przedmiar: string
  newWorks: string
  notesAppendix: string
}
type NewWorkT = {
  section: string
  catalogueId: number | null
  description?: string
  unit?: string
  qty: number
  clientPrice?: number
  note: string
}

const DRY = process.env.DRY === '1'
const CASE_DIR = path.join(import.meta.dirname, '../cases', process.env.CASE ?? '')
const read = (file: string) => readFileSync(path.join(CASE_DIR, file), 'utf8')

async function run() {
  const kase: CaseT = JSON.parse(read('case.json'))
  const page = `/inwestycje/${kase.investmentId}/kosztorys_v2`
  const rozpiska = new Map<number, string>()
  for (const line of read(`inputs/rozpiska-szablon-${kase.presetId}.txt`).split('\n')) {
    if (!line.trim()) continue
    const [, section, id, desc] = line.split(' | ').map((s) => s.trim())
    rozpiska.set(Number(id), `${norm(section)}|${norm(desc)}`)
  }
  const rows: { id: number; qty: number; note: string }[] = JSON.parse(read(kase.przedmiar))
  const newWorks: NewWorkT[] = existsSync(path.join(CASE_DIR, kase.newWorks))
    ? JSON.parse(read(kase.newWorks))
    : []
  const appendix = existsSync(path.join(CASE_DIR, kase.notesAppendix))
    ? read(kase.notesAppendix).trim()
    : ''

  // Matching every row before anything is written: a run never stops halfway on a bad rozpiska id.
  const items = await itemsOf(kase.investmentId)
  const byKey = keyed(items)
  for (const { id } of rows) {
    const key = rozpiska.get(id)
    const n = key ? (byKey.get(key)?.length ?? 0) : 0
    if (n !== 1) throw new Error(`rozpiska ${id} matches ${n} kosztorys items (${key})`)
  }
  for (const work of newWorks) {
    if (!items.some((i) => norm(i.section.name) === norm(work.section)))
      throw new Error(`no section ${work.section}`)
  }
  // A second run would overwrite the owner's edits and add the new works twice.
  if (!process.env.SKIP_ROWS && items.some((i) => i.plannedQty !== 0)) {
    throw new Error(
      `#${kase.investmentId} already has Przedmiar ≠ 0 — SKIP_ROWS=1 to only add new works`,
    )
  }
  await resolveActions(page, ['addItemAction', 'updateItemFieldAction'])
  if (appendix) await resolveActions(`/inwestycje/${kase.investmentId}`, ['updateInvestmentAction'])
  console.log(
    `ok: ${rows.length} rows, ${newWorks.length} new works, notes appendix: ${appendix ? 'yes' : 'no'}`,
  )
  if (DRY) return

  if (!process.env.SKIP_ROWS) {
    for (const { id, qty, note } of rows) {
      const [item] = byKey.get(rozpiska.get(id) ?? '') ?? []
      await callAction('updateItemFieldAction', page, [item.id, { plannedQty: qty, note }])
    }
    console.log(`${rows.length} rows filled`)
  }

  // Production runs `main`, where „Dodaj pracę" adds a blank row and the grid fills it cell by cell —
  // so this does the same, one patch per row.
  for (const work of newWorks) {
    const section = items.find((i) => norm(i.section.name) === norm(work.section))?.section
    const catalogue = work.catalogueId
      ? await api<Record<string, unknown>>(`/work-catalogue-items/${work.catalogueId}?depth=0`)
      : null
    const added = await callAction<{ data: { id: number } }>('addItemAction', page, [section?.id])
    await callAction('updateItemFieldAction', page, [
      added.data.id,
      {
        description: catalogue?.description ?? work.description,
        unit: catalogue?.unit ?? work.unit,
        clientPrice: catalogue?.clientPrice ?? work.clientPrice ?? 0,
        wToolsOverrideValue: catalogue?.wToolsRate ?? null,
        wToolsOverrideCoeff: catalogue?.wToolsRateCoeff ?? null,
        ownToolsOverrideValue: catalogue?.ownToolsRate ?? null,
        ownToolsOverrideCoeff: catalogue?.ownToolsRateCoeff ?? null,
        plannedQty: work.qty,
        note: work.note,
      },
    ])
  }
  console.log(`${newWorks.length} new works added`)

  if (appendix) {
    const inv = await api<Record<string, string | null>>(
      `/investments/${kase.investmentId}?depth=0`,
    )
    const fields = [
      'name',
      'address',
      'phone',
      'email',
      'contactPerson',
      'review',
      'status',
    ] as const
    const data = Object.fromEntries(fields.map((f) => [f, inv[f] ?? '']))
    const notes = [inv.notes, appendix].filter(Boolean).join('\n\n')
    await callAction('updateInvestmentAction', `/inwestycje/${kase.investmentId}`, [
      kase.investmentId,
      { ...data, notes, presetId: '' },
    ])
    console.log('notes appendix added')
  }

  const total = (await itemsOf(kase.investmentId)).reduce(
    (sum, i) => sum + i.plannedQty * i.clientPrice,
    0,
  )
  console.log(`Wartość netto przedmiar: ${Math.round(total)} zł → ${BASE}${page}`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
