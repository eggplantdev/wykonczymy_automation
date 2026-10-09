// Step 2 of a case on PRODUCTION: writes the agent's result into the investment `new-case-prod.ts`
// created — Przedmiar + Komentarz on the szablon positions, the new works appended to their sections
// (a section the kosztorys lacks is created at the end), and the notes appendix put above the mail in
// the investment notes. Everything it needs is in `cases/<CASE>/case.json`.
//
// A case with a `draft` goes to AI przedmiar instead, which no app action writes (owner, 2026-10-07):
// this only creates the sections the draft needs and adds the notes, and `src/scripts/load-ai-draft.ts`
// — run from a checkout of what production runs — loads the rows.
//   TOKEN_FILE=… CASE=02-<slug> [DRY=1] [SKIP_ROWS=1] \
//     node --import tsx context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/fill-case-prod.ts
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { sectionItemKey } from '@/lib/kosztorys/sheet-import/item-key'
import {
  api,
  BASE,
  callAction,
  itemsOf,
  keyed,
  norm,
  NOTES_SEPARATOR,
  resolveActions,
  type ItemT,
} from './prod-client'

type CaseT = {
  investmentId: number
  presetId: number
  przedmiar: string
  newWorks: string
  // The `load-ai-draft.ts` shape, keyed by section + opis; when set, it replaces `przedmiar` and
  // `newWorks`.
  draft?: string
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
type DraftRowT = {
  section: string
  description: string
  qty: number
  unit?: string
  clientPrice?: number
  note: string
}
type FillT = { item: ItemT; qty: number; note: string }

const DRY = process.env.DRY === '1'
const CASE_DIR = path.join(import.meta.dirname, '../cases', process.env.CASE ?? '')
const read = (file: string) => readFileSync(path.join(CASE_DIR, file), 'utf8')
const has = (file?: string) => !!file && existsSync(path.join(CASE_DIR, file))
const sectionKey = (name: string) => sectionItemKey(name, null)

function fromRozpiska(kase: CaseT, items: ItemT[]) {
  const rozpiska = new Map<number, string>()
  for (const line of read(`inputs/rozpiska-szablon-${kase.presetId}.txt`).split('\n')) {
    if (!line.trim()) continue
    const [, section, id, desc] = line.split(' | ').map((s) => s.trim())
    rozpiska.set(Number(id), `${norm(section)}|${norm(desc)}`)
  }
  const byKey = keyed(items)
  const rows: { id: number; qty: number; note: string }[] = JSON.parse(read(kase.przedmiar))
  const fills = rows.map(({ id, qty, note }): FillT => {
    const key = rozpiska.get(id)
    const matches = key ? (byKey.get(key) ?? []) : []
    if (matches.length !== 1)
      throw new Error(`rozpiska ${id} matches ${matches.length} kosztorys items (${key})`)
    return { item: matches[0], qty, note }
  })
  const newWorks: NewWorkT[] = has(kase.newWorks) ? JSON.parse(read(kase.newWorks)) : []
  return { fills, newWorks }
}

// Only what the loader can't do itself: it skips a row whose section is missing.
function fromDraft(draftFile: string, items: ItemT[]) {
  const byKey = new Map(items.map((i) => [sectionItemKey(i.section.name, i.description), i]))
  const rows: DraftRowT[] = JSON.parse(read(draftFile))
  const newWorks = rows
    .filter((row) => !byKey.has(sectionItemKey(row.section, row.description)))
    .map((row): NewWorkT => ({ ...row, catalogueId: null }))
  const aiTotal = rows.reduce((sum, row) => {
    const item = byKey.get(sectionItemKey(row.section, row.description))
    return sum + row.qty * (item?.clientPrice ?? row.clientPrice ?? 0)
  }, 0)
  return { matched: rows.length - newWorks.length, newWorks, aiTotal }
}

async function run() {
  const kase: CaseT = JSON.parse(read('case.json'))
  const page = `/inwestycje/${kase.investmentId}/kosztorys_v2`
  const appendix = has(kase.notesAppendix) ? read(kase.notesAppendix).trim() : ''

  // Matching every row before anything is written: a run never stops halfway on a bad rozpiska id.
  const items = await itemsOf(kase.investmentId)
  const draft = kase.draft && has(kase.draft) ? fromDraft(kase.draft, items) : undefined
  const { fills, newWorks } = draft
    ? { fills: [] as FillT[], newWorks: draft.newWorks }
    : fromRozpiska(kase, items)
  const sectionIds = new Map(items.map((i) => [sectionKey(i.section.name), i.section.id]))
  const missingSections = [
    ...new Set(newWorks.map((w) => w.section).filter((s) => !sectionIds.has(sectionKey(s)))),
  ]
  // A second run would overwrite the owner's edits and add the new works twice.
  if (!draft && !process.env.SKIP_ROWS && items.some((i) => i.plannedQty !== 0)) {
    throw new Error(
      `#${kase.investmentId} already has Przedmiar ≠ 0 — SKIP_ROWS=1 to only add new works`,
    )
  }
  await resolveActions(page, [
    'addItemAction',
    'updateItemFieldAction',
    'insertSectionAction',
    'updateSectionFieldAction',
  ])
  if (appendix) await resolveActions(`/inwestycje/${kase.investmentId}`, ['updateInvestmentAction'])
  const rowsLine = draft
    ? `draft ${draft.matched} matched + ${newWorks.length} new (the loader writes them)`
    : `${fills.length} rows, ${newWorks.length} new works`
  console.log(
    `ok: ${rowsLine}, new sections: ${missingSections.join(', ') || 'none'}, notes appendix: ${appendix ? 'yes' : 'no'}`,
  )
  // Katalog-matched new works take the katalog's price at write time, so this is exact only when
  // every new work carries its own clientPrice.
  const expected = draft
    ? draft.aiTotal
    : fills.reduce((sum, f) => sum + f.qty * f.item.clientPrice, 0) +
      newWorks.reduce((sum, w) => sum + w.qty * (w.clientPrice ?? 0), 0)
  const figure = draft ? 'AI przedmiar' : 'Wartość netto przedmiar'
  console.log(`expected ${figure}: ${expected.toFixed(2)} zł`)
  if (DRY) return

  if (!draft && !process.env.SKIP_ROWS) {
    for (const { item, qty, note } of fills) {
      await callAction('updateItemFieldAction', page, [item.id, { plannedQty: qty, note }])
    }
    console.log(`${fills.length} rows filled`)
  }

  // Each new section goes below the last one, so they keep the order the agent wrote them in.
  let lastSectionId = items.toSorted((a, b) => b.section.displayOrder - a.section.displayOrder)[0]
    .section.id
  for (const name of missingSections) {
    const created = await callAction<{ data: { section: { id: number } } }>(
      'insertSectionAction',
      page,
      [lastSectionId, 'below'],
    )
    lastSectionId = created.data.section.id
    await callAction('updateSectionFieldAction', page, [lastSectionId, { name }])
    sectionIds.set(sectionKey(name), lastSectionId)
    console.log(`section „${name}" #${lastSectionId}`)
  }

  for (const work of draft ? [] : newWorks) {
    const catalogue = work.catalogueId
      ? await api<Record<string, string | number | null>>(
          `/work-catalogue-items/${work.catalogueId}?depth=0`,
        )
      : null
    const added = await callAction<{ data: { item: { id: number } } }>('addItemAction', page, [
      {
        placement: { kind: 'end', sectionId: sectionIds.get(sectionKey(work.section)) },
        data: {
          description: catalogue?.description ?? work.description,
          unit: catalogue?.unit ?? work.unit,
          category: '',
          clientPrice: catalogue?.clientPrice ?? work.clientPrice ?? 0,
          wToolsRate: catalogue?.wToolsRate ?? null,
          wToolsRateCoeff: catalogue?.wToolsRateCoeff ?? null,
          ownToolsRate: catalogue?.ownToolsRate ?? null,
          ownToolsRateCoeff: catalogue?.ownToolsRateCoeff ?? null,
        },
        catalogue: null,
      },
    ])
    await callAction('updateItemFieldAction', page, [
      added.data.item.id,
      { plannedQty: work.qty, note: work.note },
    ])
  }
  if (!draft) console.log(`${newWorks.length} new works added`)

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
    // Doubts go above the mail; a rerun replaces the previous doubts instead of stacking them.
    const mail = (inv.notes ?? '').split(NOTES_SEPARATOR).at(-1)?.trim() ?? ''
    const notes = [appendix, NOTES_SEPARATOR, mail].join('\n\n')
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
  console.log(`Wartość netto przedmiar: ${total.toFixed(2)} zł → ${BASE}${page}`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
