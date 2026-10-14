// Step 1 of a case whose investment the owner already created on PRODUCTION, with the client's mail in
// its notes and the files in „Pliki". The counterpart of `new-case-prod.ts`: it downloads the files
// (outside the repo — they are a real client's documents) and scaffolds `cases/<CASE>/` the same way, so the rest of the method runs unchanged.
//   TOKEN_FILE=… INVESTMENT=207 CASE=07-<slug> [FILES_DIR=…] [PRESET_ID=166] [DRY=1] \
//     node --import tsx context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/adopt-case-prod.ts
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { api, BASE, forAiAnalysis, itemsOf, type AssetT } from './prod-client'

type InvestmentT = { id: number; name: string; notes: string | null; assets: AssetT[] | null }

const INVESTMENT = Number(process.env.INVESTMENT)
const PRESET_ID = Number(process.env.PRESET_ID ?? 166)
const DRY = process.env.DRY === '1'
const CASE = process.env.CASE ?? ''
const CASE_DIR = path.join(import.meta.dirname, '../cases', CASE)
const FILES_DIR =
  process.env.FILES_DIR ?? path.join(homedir(), '.local/share/wykonczymy-ai-cases', CASE)

async function run() {
  if (!INVESTMENT || !CASE) throw new Error('INVESTMENT and CASE are required')
  if (existsSync(path.join(CASE_DIR, 'case.json')))
    throw new Error(`${CASE_DIR} already has a case.json`)

  const investment = await api<InvestmentT>(`/investments/${INVESTMENT}?depth=1`)
  const allAssets = investment.assets ?? []
  const assets = allAssets.filter(forAiAnalysis)
  const skipped = allAssets.length - assets.length
  if (skipped) console.log(`${skipped} files not marked „Do analizy AI” → skipped`)
  const items = await itemsOf(INVESTMENT)
  const template = await itemsOf(PRESET_ID)
  if (!template.length) throw new Error(`szablon #${PRESET_ID} has no items`)
  const page = `/inwestycje/${INVESTMENT}/kosztorys_v2`
  // A kosztorys the owner already filled is an answer key: the draft goes in beside it as AI
  // przedmiar, so it is never reloaded over. An empty one is seeded by fill-case-prod, so this step
  // writes nothing to production.
  const isEmpty = items.length === 0

  for (const asset of assets) console.log(`${(asset.kind ?? '—').padEnd(8)} ${asset.filename}`)
  console.log(
    `ok: #${INVESTMENT} „${investment.name.trim()}", ${assets.length} files → ${FILES_DIR}, ` +
      (isEmpty
        ? `kosztorys empty → rozpiska from szablon #${PRESET_ID} (${template.length} positions)`
        : `kosztorys has ${items.length} positions → left as is`),
  )
  if (DRY) return

  mkdirSync(FILES_DIR, { recursive: true })
  for (const asset of assets) {
    const res = await fetch(`${BASE}${asset.url}`)
    if (!res.ok) throw new Error(`${asset.filename}: ${res.status}`)
    writeFileSync(path.join(FILES_DIR, asset.filename), Buffer.from(await res.arrayBuffer()))
  }
  console.log(`${assets.length} files downloaded`)

  const rozpiska = (isEmpty ? template : items)
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
  // All of Notatki: people write the new information wherever they like.
  writeFileSync(
    path.join(CASE_DIR, 'inputs/client-inquiry.md'),
    (investment.notes ?? '').trim() + '\n',
  )
  writeFileSync(
    path.join(CASE_DIR, 'case.json'),
    JSON.stringify(
      {
        investmentId: INVESTMENT,
        presetId: PRESET_ID,
        files: assets.map((a) => ({ name: a.filename, kind: a.kind })),
        draft: 'measure/ai-draft-load.json',
        notesAppendix: 'investment-notes-appendix.txt',
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`investment #${INVESTMENT} → ${BASE}${page}`)
  console.log(
    `scaffolded ${path.relative(process.cwd(), CASE_DIR)} — redact contacts in client-inquiry.md`,
  )
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
