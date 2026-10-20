// Step 1 of a later round (EX-1057) on PRODUCTION, read-only: works out what is new since the last
// round's record, downloads the new files and hands the agent the kosztorys as the owner left it.
// The record lives beside the files, outside the repo — Notatki carry the client's name and contacts.
// Round 2 with no record yet starts from round 1's inputs: `case.json` files + `client-inquiry.md`
// (redacted, so a redacted line reads as new — the agent judges it).
//   TOKEN_FILE=… CASE=05-<slug> ROUND=2 [FILES_DIR=…] [DRY=1] \
//     node --import tsx scripts/ai-kosztorys/round-case-prod.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { REVIEW_STATUS_LABELS, REVIEW_STATUS_UNSET_LABEL } from '@/lib/kosztorys/labels'
import { effectiveReviewStatus } from '@/lib/kosztorys/review-status'
import {
  api,
  byKosztorysOrder,
  assertRoundFieldsDeployed,
  BASE,
  CASES_ROOT,
  forAiAnalysis,
  itemsOf,
  lines,
  norm,
  type AssetT,
  type ItemT,
} from './prod-client'
import {
  initialInfoLines,
  initialInfoMarkdown,
  parseInitialInfoMarkdown,
  type InitialInfoT,
} from './initial-info'

type CaseT = { investmentId: number; files: { name: string }[] }
type InvestmentT = {
  notes: string | null
  initialInfo?: InitialInfoT | null
  aiNotes: string | null
  assets: AssetT[] | null
}
type RoundRecordT = {
  round: number
  at: string
  notes: string
  // Missing from a record written before the section existed.
  initialInfo?: string[]
  files: { name: string; createdAt: string | null }[]
  aiNotes: string
}

const DRY = process.env.DRY === '1'
const CASE = process.env.CASE ?? ''
const ROUND = Number(process.env.ROUND)
const CASE_DIR = path.join(CASES_ROOT, 'cases', CASE)
const FILES_DIR =
  process.env.FILES_DIR ?? path.join(homedir(), '.local/share/wykonczymy-ai-cases', CASE)
const ROUNDS_DIR = path.join(FILES_DIR, 'rounds')
const ROUND_DIR = path.join(ROUNDS_DIR, String(ROUND))

const cell = (value: string | number | null | undefined) =>
  value === null || value === undefined ? '' : norm(String(value))

function baseline(kase: CaseT): RoundRecordT {
  const previous = path.join(ROUNDS_DIR, `${ROUND - 1}.json`)
  if (existsSync(previous)) return JSON.parse(readFileSync(previous, 'utf8'))
  if (ROUND !== 2) throw new Error(`no record of round ${ROUND - 1} (${previous})`)
  const initialInfoFile = path.join(CASE_DIR, 'inputs/initial-info.md')
  return {
    round: 1,
    at: '',
    notes: readFileSync(path.join(CASE_DIR, 'inputs/client-inquiry.md'), 'utf8'),
    initialInfo: existsSync(initialInfoFile)
      ? parseInitialInfoMarkdown(readFileSync(initialInfoFile, 'utf8'))
      : initialInfoLines(null),
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
  const previous = baseline(kase)

  const investment = await api<InvestmentT>(`/investments/${kase.investmentId}?depth=1`)
  const assets = (investment.assets ?? []).filter(forAiAnalysis)
  const knownFiles = new Set(previous.files.map((file) => file.name))
  const newFiles = assets.filter((asset) => !knownFiles.has(asset.filename))
  const notes = (investment.notes ?? '').trim()
  const knownLines = new Set(lines(previous.notes))
  const newNotes = lines(notes).filter((line) => !knownLines.has(line))
  const initialInfo = initialInfoLines(investment.initialInfo)
  // A baseline from before the section existed reads as every field empty, not as no lines.
  const knownInitialInfo = new Set(previous.initialInfo ?? initialInfoLines(null))
  const newInitialInfo = initialInfo.filter((line) => !knownInitialInfo.has(line))
  const items = await itemsOf(kase.investmentId)
  assertRoundFieldsDeployed(items)
  const kosztorys = items.toSorted(byKosztorysOrder).map(kosztorysLine)

  for (const asset of newFiles) console.log(`new file  ${asset.filename}`)
  for (const line of newNotes) console.log(`new note  ${line}`)
  for (const line of newInitialInfo) console.log(`new initial info  ${line}`)
  console.log(
    `ok: #${kase.investmentId} round ${ROUND} against round ${previous.round}: ` +
      `${newFiles.length} new files, ${newNotes.length} new Notatki lines, ` +
      `${newInitialInfo.length} changed Wstępne informacje lines, ${items.length} pozycji → ${ROUND_DIR}`,
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
  writeFileSync(path.join(ROUND_DIR, 'initial-info.md'), initialInfoMarkdown(initialInfo))
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
    initialInfo,
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
