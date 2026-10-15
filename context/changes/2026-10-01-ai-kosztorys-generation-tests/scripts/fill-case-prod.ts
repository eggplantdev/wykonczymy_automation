// Step 2 of a case on PRODUCTION: prepares the investment `new-case-prod.ts` created for the agent's
// draft — seeds the kosztorys from the szablon when empty, creates the sections the draft needs (at
// the end, a bathroom or WC one as a copy of „Łazienka" — see BATHROOM_TEMPLATE) and writes the notes
// appendix as „Uwagi AI”. It writes no pozycja field: the AI przedmiar goes in with
// `load-draft-sql-prod.ts`, and Przedmiar, Status, Powód zmiany and Komentarz are the owner's.
// Everything it needs is in `cases/<CASE>/case.json`.
// ROUND=N (a later round, EX-1057) reads `measure/ai-draft-round-<N>.json` and
// `investment-notes-appendix-round-<N>.txt` instead. It renames „Łazienka" only while that is still
// the investment's one bathroom sekcja under the szablon's name — a first round that predates the
// per-bathroom rule (#198) — so a name the owner gave is never overwritten.
//   TOKEN_FILE=… CASE=02-<slug> [ROUND=2] [DRY=1] \
//     node --import tsx context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/fill-case-prod.ts
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { sectionItemKey } from '@/lib/kosztorys/sheet-import/item-key'
import {
  api,
  BASE,
  callAction,
  itemsOf,
  itemsOfTemplate,
  norm,
  resolveActions,
  type ItemT,
} from './prod-client'

type CaseT = {
  investmentId: number
  presetId: number
  // The draft the loader reads, keyed by section + opis.
  draft: string
  notesAppendix: string
}
type DraftRowT = {
  section: string
  description: string
  qty: number
  clientPrice?: number
}

const DRY = process.env.DRY === '1'
const ROUND = process.env.ROUND ? Number(process.env.ROUND) : undefined
const CASE_DIR = path.join(import.meta.dirname, '../cases', process.env.CASE ?? '')
const read = (file: string) => readFileSync(path.join(CASE_DIR, file), 'utf8')
const has = (file?: string) => !!file && existsSync(path.join(CASE_DIR, file))
const sectionKey = (name: string) => sectionItemKey(name, null)
const sectionsOf = async (investmentId: number) =>
  (
    await api<{ docs: { id: number; name: string; displayOrder: number }[] }>(
      `/kosztorys-sections?where[investment][equals]=${investmentId}&limit=0&pagination=false&depth=0`,
    )
  ).docs
const templateSectionsOf = async (templateId: number) =>
  (
    await api<{ docs: { id: number; name: string }[] }>(
      `/template-sections?where[template][equals]=${templateId}&limit=0&pagination=false&depth=0`,
    )
  ).docs

// The szablon has one „Łazienka"; each bathroom and each WC is its own full copy of it, named after
// the room (owner, 2026-10-14; on #188: „nie robimy nigdy razem łazienki i wc w jednej sekcji").
// No other sekcja is ever split per room.
const BATHROOM_TEMPLATE = 'Łazienka'
const isBathroomSection = (name: string) => /^(łazienka|wc)(\s|$)/.test(norm(name).toLowerCase())

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
  const added = rows.filter((row) => !itemFor(row)).length
  const aiTotal = rows.reduce(
    (sum, row) => sum + row.qty * (itemFor(row)?.clientPrice ?? row.clientPrice ?? 0),
    0,
  )
  const sections = rows.map((row) => row.section)
  return { matched: rows.length - added, added, aiTotal, sections }
}

async function run() {
  const kase: CaseT = JSON.parse(read('case.json'))
  if (ROUND !== undefined && (!Number.isInteger(ROUND) || ROUND < 2))
    throw new Error(`ROUND must be an integer ≥ 2, got ${process.env.ROUND}`)
  const draftFile = ROUND ? `measure/ai-draft-round-${ROUND}.json` : kase.draft
  const appendixFile = ROUND ? `investment-notes-appendix-round-${ROUND}.txt` : kase.notesAppendix
  if (!has(draftFile)) throw new Error(`no draft file ${draftFile}`)
  const page = `/inwestycje/${kase.investmentId}/kosztorys_v2`
  const appendix = has(appendixFile) ? read(appendixFile).trim() : ''

  // The analysis runs offline, so seeding from the szablon is the first write of the result rather
  // than of the adopt step. A dry run matches against the szablon instead.
  let items = await itemsOf(kase.investmentId)
  if (!items.length) {
    console.log(`kosztorys empty → seed from szablon #${kase.presetId}`)
    if (DRY) items = await itemsOfTemplate(kase.presetId)
    else {
      await resolveActions(page, ['reloadFromPresetAction'])
      await callAction('reloadFromPresetAction', page, [kase.investmentId, kase.presetId])
      items = await itemsOf(kase.investmentId)
    }
  }
  const draft = fromDraft(draftFile, items)
  const sectionNames = new Set(items.map((i) => sectionKey(i.section.name)))
  const missingSections = [
    ...new Set(draft.sections.filter((s) => !sectionNames.has(sectionKey(s)))),
  ]
  const bathrooms = missingSections.filter(isBathroomSection)
  const emptySections = missingSections.filter((s) => !isBathroomSection(s))
  const template = items
    .filter((i) => sectionKey(i.section.name) === sectionKey(BATHROOM_TEMPLATE))
    .toSorted((a, b) => a.displayOrder - b.displayOrder)
  if (bathrooms.length && !template.length)
    throw new Error(`#${kase.investmentId} has no „${BATHROOM_TEMPLATE}" sekcja to copy`)
  // When no row stays in „Łazienka" itself, it becomes the first bathroom rather than an empty
  // sekcja beside its copies.
  const keepsTemplate = draft.sections.some((s) => sectionKey(s) === sectionKey(BATHROOM_TEMPLATE))
  // Names, not keys: the key folds „ł” away, and `isBathroomSection` matches the written name.
  const isOnlyBathroom = !items.some(
    (i) =>
      isBathroomSection(i.section.name) &&
      sectionKey(i.section.name) !== sectionKey(BATHROOM_TEMPLATE),
  )
  const renamedTo =
    (!ROUND || isOnlyBathroom) && bathrooms.length && !keepsTemplate ? bathrooms[0] : undefined
  const copies = renamedTo ? bathrooms.slice(1) : bathrooms
  await resolveActions(page, [
    'appendPresetSectionsAction',
    'insertSectionAction',
    'updateSectionFieldAction',
  ])
  const bathroomsLine = bathrooms.length
    ? `, ${renamedTo ? `„${BATHROOM_TEMPLATE}" → „${renamedTo}", ` : ''}copies of „${BATHROOM_TEMPLATE}" (${template.length} rows): ${copies.join(', ') || 'none'}`
    : ''
  console.log(
    `ok: ${ROUND ? `round ${ROUND}, ` : ''}draft ${draft.matched} matched + ${draft.added} new (the loader writes them), new sections: ${emptySections.join(', ') || 'none'}${bathroomsLine}, Uwagi AI: ${appendix ? 'yes' : 'no'}`,
  )
  console.log(`expected AI przedmiar: ${draft.aiTotal.toFixed(2)} zł`)
  if (DRY) return

  if (renamedTo) {
    await callAction('updateSectionFieldAction', page, [
      template[0].section.id,
      { name: renamedTo },
    ])
    console.log(`section „${BATHROOM_TEMPLATE}" → „${renamedTo}"`)
  }
  // Each copy is the szablon's „Łazienka" imported whole („Importuj sekcje z szablonu"), one call
  // instead of one per row. The import lands at the end, and a sekcja's order is a plain number, so
  // the sekcje below the previous bathroom are shifted by hand to keep the bathrooms together in the
  // agent's order.
  if (copies.length) {
    const presetBathroom = (await templateSectionsOf(kase.presetId)).find(
      (s) => sectionKey(s.name) === sectionKey(BATHROOM_TEMPLATE),
    )
    if (!presetBathroom) throw new Error(`szablon #${kase.presetId} has no „${BATHROOM_TEMPLATE}"`)
    let anchorOrder = template[0].section.displayOrder
    for (const name of copies) {
      const below = (await sectionsOf(kase.investmentId)).filter(
        (s) => s.displayOrder > anchorOrder,
      )
      const appended = await callAction<{ data: { id: number }[] }>(
        'appendPresetSectionsAction',
        page,
        [kase.investmentId, [presetBathroom.id]],
      )
      const copyId = appended.data[0].id
      for (const s of below) {
        await callAction('updateSectionFieldAction', page, [
          s.id,
          { displayOrder: s.displayOrder + 1 },
        ])
      }
      anchorOrder += 1
      await callAction('updateSectionFieldAction', page, [
        copyId,
        { name, displayOrder: anchorOrder },
      ])
      console.log(`section „${name}" #${copyId} (imported from szablon #${kase.presetId})`)
    }
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
    console.log(`section „${name}" #${lastSectionId}`)
  }

  if (appendix) {
    // „Uwagi AI” are the script's alone, so a rerun overwrites them; Notatki stay the people's.
    await api(`/investments/${kase.investmentId}?depth=0`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiNotes: appendix }),
    })
    console.log('„Uwagi AI” written')
  }

  console.log(`${BASE}${page} — now load the rows with load-draft-sql-prod.ts`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
