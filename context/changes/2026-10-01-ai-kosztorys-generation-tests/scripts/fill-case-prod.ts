// Step 2 of a case on PRODUCTION: writes the agent's result into the investment `new-case-prod.ts`
// created — Przedmiar + Komentarz on the szablon positions, the new works appended to their sections
// (a section the kosztorys lacks is created at the end, a bathroom or WC one as a copy of „Łazienka"
// — see BATHROOM_TEMPLATE), and the notes appendix as the investment's „Uwagi AI”. Everything it needs is in `cases/<CASE>/case.json`.
//
// A case with a `draft` goes to AI przedmiar instead, which no app action writes (owner, 2026-10-07):
// this only creates the sections the draft needs and writes „Uwagi AI”, and `src/scripts/load-ai-draft.ts`
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

// The szablon has one „Łazienka"; each bathroom and each WC is its own full copy of it, named after
// the room (owner, 2026-10-14; on #188: „nie robimy nigdy razem łazienki i wc w jednej sekcji").
// No other sekcja is ever split per room.
const BATHROOM_TEMPLATE = 'Łazienka'
const isBathroomSection = (name: string) => /^(łazienka|wc)(\s|$)/.test(norm(name).toLowerCase())

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
  // A row in a bathroom sekcja the kosztorys lacks matches the „Łazienka" row it will be copied from.
  const itemFor = (row: DraftRowT) =>
    byKey.get(sectionItemKey(row.section, row.description)) ??
    (isBathroomSection(row.section)
      ? byKey.get(sectionItemKey(BATHROOM_TEMPLATE, row.description))
      : undefined)
  const rows: DraftRowT[] = JSON.parse(read(draftFile))
  const newWorks = rows
    .filter((row) => !itemFor(row))
    .map((row): NewWorkT => ({ ...row, catalogueId: null }))
  const aiTotal = rows.reduce(
    (sum, row) => sum + row.qty * (itemFor(row)?.clientPrice ?? row.clientPrice ?? 0),
    0,
  )
  const sections = rows.map((row) => row.section)
  return { matched: rows.length - newWorks.length, newWorks, aiTotal, sections }
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
  const wantedSections = draft ? draft.sections : newWorks.map((w) => w.section)
  const missingSections = [...new Set(wantedSections.filter((s) => !sectionIds.has(sectionKey(s))))]
  const bathrooms = missingSections.filter(isBathroomSection)
  const emptySections = missingSections.filter((s) => !isBathroomSection(s))
  const template = items
    .filter((i) => sectionKey(i.section.name) === sectionKey(BATHROOM_TEMPLATE))
    .toSorted((a, b) => a.displayOrder - b.displayOrder)
  if (bathrooms.length && !template.length)
    throw new Error(`#${kase.investmentId} has no „${BATHROOM_TEMPLATE}" sekcja to copy`)
  // When no row stays in „Łazienka" itself, it becomes the first bathroom rather than an empty
  // sekcja beside its copies.
  const keepsTemplate = wantedSections.some((s) => sectionKey(s) === sectionKey(BATHROOM_TEMPLATE))
  const renamedTo = bathrooms.length && !keepsTemplate ? bathrooms[0] : undefined
  const copies = renamedTo ? bathrooms.slice(1) : bathrooms
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
  const rowsLine = draft
    ? `draft ${draft.matched} matched + ${newWorks.length} new (the loader writes them)`
    : `${fills.length} rows, ${newWorks.length} new works`
  const bathroomsLine = bathrooms.length
    ? `, ${renamedTo ? `„${BATHROOM_TEMPLATE}" → „${renamedTo}", ` : ''}copies of „${BATHROOM_TEMPLATE}" (${template.length} rows): ${copies.join(', ') || 'none'}`
    : ''
  console.log(
    `ok: ${rowsLine}, new sections: ${emptySections.join(', ') || 'none'}${bathroomsLine}, Uwagi AI: ${appendix ? 'yes' : 'no'}`,
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

  if (renamedTo) {
    await callAction('updateSectionFieldAction', page, [
      template[0].section.id,
      { name: renamedTo },
    ])
    sectionIds.set(sectionKey(renamedTo), template[0].section.id)
    console.log(`section „${BATHROOM_TEMPLATE}" → „${renamedTo}"`)
  }
  // Each copy goes below the previous one, so the bathrooms stay together in the agent's order.
  let bathroomAnchorId = template[0]?.section.id
  for (const name of copies) {
    const created = await callAction<{ data: { section: { id: number } } }>(
      'insertSectionAction',
      page,
      [bathroomAnchorId, 'below'],
    )
    bathroomAnchorId = created.data.section.id
    await callAction('updateSectionFieldAction', page, [bathroomAnchorId, { name }])
    sectionIds.set(sectionKey(name), bathroomAnchorId)
    for (const item of template) {
      await callAction('addItemAction', page, [
        {
          placement: { kind: 'end', sectionId: bathroomAnchorId },
          data: {
            description: item.description,
            unit: item.unit,
            category: '',
            clientPrice: item.clientPrice,
            wToolsRate: item.wToolsOverrideValue,
            wToolsRateCoeff: item.wToolsOverrideCoeff,
            ownToolsRate: item.ownToolsOverrideValue,
            ownToolsRateCoeff: item.ownToolsOverrideCoeff,
          },
          catalogue: null,
        },
      ])
    }
    console.log(`section „${name}" #${bathroomAnchorId} (${template.length} rows copied)`)
  }

  // Each new section goes below the last one, so they keep the order the agent wrote them in.
  let lastSectionId = items.toSorted((a, b) => b.section.displayOrder - a.section.displayOrder)[0]
    .section.id
  for (const name of emptySections) {
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
    // „Uwagi AI” are the script's alone, so a rerun overwrites them; Notatki stay the people's.
    await api(`/investments/${kase.investmentId}?depth=0`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiNotes: appendix }),
    })
    console.log('„Uwagi AI” written')
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
