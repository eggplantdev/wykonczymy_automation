// Step 1 of a later round (EX-1057) on PRODUCTION, read-only: works out what is new since the last
// round's record, downloads the new files and hands the agent the kosztorys as the owner left it.
// The record lives beside the files, outside the repo — Notatki carry the client's name and contacts.
// Round 2 with no record yet starts from round 1's inputs: `case.json` files + `client-inquiry.md`
// (redacted, so a redacted line reads as new — the agent judges it).
//   TOKEN_FILE=… CASE=05-<slug> ROUND=2 [FILES_DIR=…] [DRY=1] \
//     node --import tsx context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/round-case-prod.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { REVIEW_STATUS_LABELS, REVIEW_STATUS_UNSET_LABEL } from '@/lib/kosztorys/labels'
import { effectiveReviewStatus } from '@/lib/kosztorys/review-status'
import {
  api,
  assertRoundFieldsDeployed,
  BASE,
  forAiAnalysis,
  itemsOf,
  norm,
  type AssetT,
  type ItemT,
} from './prod-client'

type CaseT = { investmentId: number; files: { name: string }[] }
type InvestmentT = { notes: string | null; aiNotes: string | null; assets: AssetT[] | null }
type RoundRecordT = {
  round: number
  at: string
  notes: string
  files: { name: string; createdAt: string | null }[]
  aiNotes: string
}

const DRY = process.env.DRY === '1'
const CASE = process.env.CASE ?? ''
const ROUND = Number(process.env.ROUND)
const CASE_DIR = path.join(import.meta.dirname, '../cases', CASE)
const FILES_DIR =
  process.env.FILES_DIR ?? path.join(homedir(), '.local/share/wykonczymy-ai-cases', CASE)
const ROUNDS_DIR = path.join(FILES_DIR, 'rounds')
const ROUND_DIR = path.join(ROUNDS_DIR, String(ROUND))

const lines = (text: string) => text.split('\n').map(norm).filter(Boolean)
const cell = (value: string | number | null | undefined) =>
  value === null || value === undefined ? '' : norm(String(value))

function baseline(): RoundRecordT {
  const previous = path.join(ROUNDS_DIR, `${ROUND - 1}.json`)
  if (existsSync(previous)) return JSON.parse(readFileSync(previous, 'utf8'))
  if (ROUND !== 2) throw new Error(`no record of round ${ROUND - 1} (${previous})`)
  const kase: CaseT = JSON.parse(readFileSync(path.join(CASE_DIR, 'case.json'), 'utf8'))
  return {
    round: 1,
    at: '',
    notes: readFileSync(path.join(CASE_DIR, 'inputs/client-inquiry.md'), 'utf8'),
    files: kase.files.map((file) => ({ name: file.name, createdAt: null })),
    aiNotes: '',
  }
}

function kosztorysLine(item: ItemT) {
  const status = effectiveReviewStatus(item)
  return [
    item.section.name,
    item.description,
    item.unit,
    item.clientPrice,
    item.plannedQty,
    item.aiPlannedQty,
    status ? REVIEW_STATUS_LABELS[status] : REVIEW_STATUS_UNSET_LABEL,
    item.changeReason,
    [item.aiMissingData, item.aiAssumptions].filter(Boolean).join(' / '),
    item.aiNewInformation?.split('\n').join(' / '),
  ]
    .map(cell)
    .join(' | ')
}

async function run() {
  if (!CASE || !Number.isInteger(ROUND) || ROUND < 2)
    throw new Error('CASE and ROUND (an integer ≥ 2) are required')
  const recordFile = path.join(ROUNDS_DIR, `${ROUND}.json`)
  if (existsSync(recordFile)) throw new Error(`round ${ROUND} already has a record (${recordFile})`)
  const kase: CaseT = JSON.parse(readFileSync(path.join(CASE_DIR, 'case.json'), 'utf8'))
  const previous = baseline()

  const investment = await api<InvestmentT>(`/investments/${kase.investmentId}?depth=1`)
  const assets = (investment.assets ?? []).filter(forAiAnalysis)
  const knownFiles = new Set(previous.files.map((file) => file.name))
  const newFiles = assets.filter((asset) => !knownFiles.has(asset.filename))
  const notes = (investment.notes ?? '').trim()
  const knownLines = new Set(lines(previous.notes))
  const newNotes = lines(notes).filter((line) => !knownLines.has(line))
  const items = await itemsOf(kase.investmentId)
  assertRoundFieldsDeployed(items)
  const kosztorys = items
    .toSorted(
      (a, b) => a.section.displayOrder - b.section.displayOrder || a.displayOrder - b.displayOrder,
    )
    .map(kosztorysLine)

  for (const asset of newFiles) console.log(`new file  ${asset.filename}`)
  for (const line of newNotes) console.log(`new note  ${line}`)
  console.log(
    `ok: #${kase.investmentId} round ${ROUND} against round ${previous.round}: ` +
      `${newFiles.length} new files, ${newNotes.length} new Notatki lines, ${items.length} pozycji → ${ROUND_DIR}`,
  )
  if (DRY) return

  mkdirSync(ROUND_DIR, { recursive: true })
  for (const asset of newFiles) {
    const res = await fetch(`${BASE}${asset.url}`)
    if (!res.ok) throw new Error(`${asset.filename}: ${res.status}`)
    writeFileSync(path.join(FILES_DIR, asset.filename), Buffer.from(await res.arrayBuffer()))
  }
  writeFileSync(path.join(ROUND_DIR, 'notes.md'), notes + '\n')
  writeFileSync(path.join(ROUND_DIR, 'new-notes.md'), newNotes.join('\n') + '\n')
  writeFileSync(
    path.join(ROUND_DIR, 'new-files.txt'),
    newFiles.map((asset) => asset.filename).join('\n') + '\n',
  )
  writeFileSync(
    path.join(ROUND_DIR, 'kosztorys.txt'),
    [
      'sekcja | opis | j.m. | cena | Przedmiar | AI przedmiar | Status | Powód zmiany | Komentarz AI | Nowe informacje',
      ...kosztorys,
    ].join('\n') + '\n',
  )
  const record: RoundRecordT = {
    round: ROUND,
    at: new Date().toISOString(),
    notes,
    files: assets.map((asset) => ({ name: asset.filename, createdAt: asset.createdAt })),
    aiNotes: investment.aiNotes ?? '',
  }
  writeFileSync(recordFile, JSON.stringify(record, null, 2) + '\n')
  console.log(`${newFiles.length} files downloaded, round ${ROUND} recorded`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
