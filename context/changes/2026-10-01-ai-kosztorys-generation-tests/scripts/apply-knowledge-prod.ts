// Steps 3–4 of the knowledge flow: writes the agreed Komentarze do pracy and Manual entries from
// knowledge-edits.json through the app's own actions. An edit already in place is skipped, so a second
// DRY run printing nothing to change IS the check that prod matches the file.
//   TOKEN_FILE=… [DRY=1] \
//     node --import tsx context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/apply-knowledge-prod.ts
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { api, callAction, norm, resolveActions } from './prod-client'

// `description` is the start of the praca's opis, checked against prod so a mistyped id can't write
// a comment onto the wrong praca.
type CatalogueEditT = { catalogue: number; description: string; op: 'set' | 'append'; text: string }
type ManualEditT =
  | { manual: string; op: 'set' | 'create'; text: string }
  | { manual: string; op: 'delete' }
type EditT = CatalogueEditT | ManualEditT

type CatalogueItemT = { id: number; description: string; workNote: string | null }
type KnowledgeT = { id: number; topic: string; content: string }

const PAGE = '/katalog-prac'
// The note action ships only in the kosztorys editor's chunks; any investment's editor carries it.
const EDITOR_PAGE = '/inwestycje/191/kosztorys_v2'
const isDry = Boolean(process.env.DRY)

const quote = (text: string) =>
  text
    .split('\n')
    .map((line) => `      | ${line}`)
    .join('\n')

function report(target: string, before: string, after: string | undefined) {
  if (after === undefined) return console.log(`USUŃ  ${target}\n${quote(before)}`)
  console.log(
    `ZMIEŃ ${target}\n    było:\n${quote(before || '(pusto)')}\n    będzie:\n${quote(after)}`,
  )
}

async function applyCatalogue(edit: CatalogueEditT) {
  const item = await api<CatalogueItemT>(`/work-catalogue-items/${edit.catalogue}?depth=0`)
  if (!norm(item.description).startsWith(norm(edit.description)))
    throw new Error(`katalog ${edit.catalogue} to „${item.description}", nie „${edit.description}"`)

  const current = item.workNote?.trim() ?? ''
  const next =
    edit.op === 'set' ? edit.text.trim() : [current, edit.text.trim()].filter(Boolean).join('\n')
  const isInPlace =
    edit.op === 'set' ? norm(current) === norm(next) : norm(current).includes(norm(edit.text))
  if (isInPlace) return false

  report(`komentarz [${item.id}] ${item.description.slice(0, 70)}`, current, next)
  if (!isDry) await callAction('updateCatalogueNoteAction', EDITOR_PAGE, [item.id, next])
  return true
}

async function applyManual(edit: ManualEditT, entries: KnowledgeT[]) {
  const entry = entries.find((candidate) => norm(candidate.topic) === norm(edit.manual))

  if (edit.op === 'delete') {
    if (!entry) return false
    report(`Manual „${entry.topic}"`, entry.content.trim(), undefined)
    if (!isDry) await callAction('deleteCompanyKnowledgeAction', PAGE, [entry.id])
    return true
  }
  if (edit.op === 'create' && entry && norm(entry.content) === norm(edit.text)) return false
  if (edit.op === 'set' && !entry) throw new Error(`w Manualu nie ma wpisu „${edit.manual}"`)

  if (entry) {
    if (norm(entry.content) === norm(edit.text)) return false
    report(`Manual „${entry.topic}"`, entry.content.trim(), edit.text.trim())
    if (!isDry)
      await callAction('updateCompanyKnowledgeAction', PAGE, [
        entry.id,
        { topic: entry.topic, content: edit.text },
      ])
    return true
  }
  console.log(`DODAJ Manual „${edit.manual}"\n${quote(edit.text.trim())}`)
  if (!isDry)
    await callAction('createCompanyKnowledgeAction', PAGE, [
      { topic: edit.manual, content: edit.text },
    ])
  return true
}

async function run() {
  const file = process.env.EDITS ?? path.join(import.meta.dirname, '../knowledge-edits.json')
  const edits: EditT[] = JSON.parse(readFileSync(file, 'utf8'))

  if (!isDry) {
    await resolveActions(EDITOR_PAGE, ['updateCatalogueNoteAction'])
    await resolveActions(PAGE, [
      'createCompanyKnowledgeAction',
      'updateCompanyKnowledgeAction',
      'deleteCompanyKnowledgeAction',
    ])
  }
  const { docs: entries } = await api<{ docs: KnowledgeT[] }>('/company-knowledge?limit=0&depth=0')

  let changed = 0
  for (const edit of edits) {
    const isChanged =
      'catalogue' in edit ? await applyCatalogue(edit) : await applyManual(edit, entries)
    if (isChanged) changed++
  }
  const verdict = changed ? `${changed} do zmiany` : 'prod zgodny z plikiem'
  console.log(
    `\n${edits.length} wpisów w pliku — ${verdict}${isDry || !changed ? '' : ' (zapisane)'}`,
  )
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
