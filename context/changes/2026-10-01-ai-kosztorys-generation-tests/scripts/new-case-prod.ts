// Step 1 of a case on PRODUCTION: uploads every file the client sent, creates the investment with its
// kosztorys seeded from the szablon, and scaffolds `cases/<CASE>/` (the szablon's rozpiska + case.json)
// for the agent to measure against. The client fields come from a JSON outside the repo (PII stays out
// of git): { name, address, phone, email, contactPerson, notes }.
//   TOKEN_FILE=… SOURCE_JSON=… FILES_DIR=… CASE=02-<slug> [PRESET_ID=165] [DRY=1] \
//     node --import tsx context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/new-case-prod.ts
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  api,
  BASE,
  callAction,
  itemsOf,
  resolveActions,
  uploadMedia,
  type MediaKindT,
} from './prod-client'

const PRESET_ID = Number(process.env.PRESET_ID ?? 165)
const DRY = process.env.DRY === '1'
const SOURCE = JSON.parse(readFileSync(process.env.SOURCE_JSON ?? '', 'utf8'))
const FILES_DIR = process.env.FILES_DIR ?? ''
const CASE_DIR = path.join(import.meta.dirname, '../cases', process.env.CASE ?? '')

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
}

// A shopping list or an offer is not a drawing, and only the name tells them apart; a wrong guess is
// one click to fix in „Pliki".
function kindOf(name: string, mimeType: string): MediaKindT {
  if (mimeType.startsWith('image/')) return 'zdjecie'
  return /zakup|lista|oferta|wycena|faktura/i.test(name) ? 'inne' : 'projekt'
}

async function run() {
  if (!process.env.CASE) throw new Error('CASE is required, e.g. CASE=02-mokotow-60m2')
  if (existsSync(path.join(CASE_DIR, 'case.json')))
    throw new Error(`${CASE_DIR} already has a case.json`)

  const files = readdirSync(FILES_DIR)
    .filter((name) => !name.startsWith('.'))
    .sort()
    .map((name) => {
      const mimeType = MIME[path.extname(name).toLowerCase()]
      return { name, mimeType, kind: mimeType ? kindOf(name, mimeType) : undefined }
    })
  const skipped = files.filter((f) => !f.mimeType)
  const uploads = files.filter((f) => f.mimeType)

  const taken = await api<{ totalDocs: number }>(
    `/investments?where[name][equals]=${encodeURIComponent(SOURCE.name)}&limit=1&depth=0`,
  )
  if (taken.totalDocs) throw new Error(`an investment named „${SOURCE.name}" already exists`)
  const template = await itemsOf(PRESET_ID)
  if (!template.length) throw new Error(`szablon #${PRESET_ID} has no items`)
  await resolveActions('/inwestycje', ['createInvestmentAction'])

  for (const f of uploads) console.log(`${f.kind?.padEnd(8)} ${f.name}`)
  for (const f of skipped) console.log(`SKIPPED  ${f.name} (media takes only PDFs and images)`)
  console.log(`ok: „${SOURCE.name}", szablon #${PRESET_ID} (${template.length} positions)`)
  if (DRY) return

  const assets: number[] = []
  for (const f of uploads) {
    const bytes = readFileSync(path.join(FILES_DIR, f.name))
    const id = await uploadMedia(f.name, bytes, f.mimeType as string, f.kind as MediaKindT)
    assets.push(id)
    console.log(`media #${id} ${f.name}`)
  }

  await callAction('createInvestmentAction', '/inwestycje', [
    { status: 'planowana', ...SOURCE, review: '', presetId: String(PRESET_ID), assets },
  ])
  const created = await api<{ docs: { id: number }[] }>(
    `/investments?where[name][equals]=${encodeURIComponent(SOURCE.name)}&sort=-id&limit=1&depth=0`,
  )
  const investmentId = created.docs[0].id

  const rozpiska = template
    .toSorted(
      (a, b) => a.section.displayOrder - b.section.displayOrder || a.displayOrder - b.displayOrder,
    )
    .map((i) =>
      [i.section.displayOrder, i.section.name, i.id, i.description, i.unit, i.clientPrice, ''].join(
        ' | ',
      ),
    )
  mkdirSync(path.join(CASE_DIR, 'inputs'), { recursive: true })
  writeFileSync(
    path.join(CASE_DIR, `inputs/rozpiska-szablon-${PRESET_ID}.txt`),
    rozpiska.join('\n') + '\n',
  )
  writeFileSync(
    path.join(CASE_DIR, 'case.json'),
    JSON.stringify(
      {
        investmentId,
        presetId: PRESET_ID,
        files: uploads.map((f) => ({ name: f.name, kind: f.kind })),
        przedmiar: 'measure/przedmiar.json',
        newWorks: 'measure/new-works.json',
        notesAppendix: 'investment-notes-appendix.txt',
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`investment #${investmentId} → ${BASE}/inwestycje/${investmentId}/kosztorys_v2`)
  console.log(`scaffolded ${path.relative(process.cwd(), CASE_DIR)}`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
