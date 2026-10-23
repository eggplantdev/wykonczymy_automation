//   TOKEN_FILE=… node --import tsx scripts/ai-kosztorys/accuracy-report-prod.ts
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  AI_ACCURACY_EXCLUDED_INVESTMENT_IDS,
  AI_ACCURACY_REVIEWED_STAGES,
  type InvestmentAiStageT,
} from '@/lib/constants/investment-ai-stage'
import { scoreCases, type AiAccuracyCaseInputT } from '@/lib/kosztorys/ai-accuracy'
import { toCsv, toCsvTables } from './accuracy'
import { api, CASES_ROOT, itemsOf } from './prod-client'

type CaseFileT = { investmentId: number; accuracyExcluded?: string }

function caseFiles() {
  const dir = path.join(CASES_ROOT, 'cases')
  return readdirSync(dir)
    .map((name) => /^(\d+)-(.+)$/.exec(name))
    .filter((match) => match !== null)
    .map(([name, number, slug]) => ({
      caseNumber: Number(number),
      slug,
      ...(JSON.parse(readFileSync(path.join(dir, name, 'case.json'), 'utf8')) as CaseFileT),
    }))
    .toSorted((a, b) => a.caseNumber - b.caseNumber)
}

async function run() {
  const { docs } = await api<{
    docs: { id: number; aiStage: InvestmentAiStageT | null; trashedAt?: string | null }[]
  }>('/investments?depth=0&pagination=false&select[aiStage]=true&select[trashedAt]=true')
  const stageOf = new Map(
    docs.map((doc) => [doc.id, doc.trashedAt ? undefined : (doc.aiStage ?? undefined)]),
  )

  const files = caseFiles()
  const scored: AiAccuracyCaseInputT[] = []
  for (const file of files) {
    const excluded = AI_ACCURACY_EXCLUDED_INVESTMENT_IDS.includes(file.investmentId)
    if (Boolean(file.accuracyExcluded) !== excluded)
      throw new Error(
        `case ${file.caseNumber}: case.json accuracyExcluded and AI_ACCURACY_EXCLUDED_INVESTMENT_IDS disagree`,
      )
    if (excluded) continue
    if (!stageOf.has(file.investmentId))
      throw new Error(`case ${file.caseNumber}: investment ${file.investmentId} not in production`)
    const stage = stageOf.get(file.investmentId)
    if (!stage || !AI_ACCURACY_REVIEWED_STAGES.includes(stage)) continue
    const items = await itemsOf(file.investmentId)
    if (!items.some((item) => item.aiPlannedQty !== null)) continue
    scored.push({ investmentId: file.investmentId, label: file.slug, items })
  }

  const caseNumberOf = new Map(files.map((file) => [file.investmentId, file.caseNumber]))
  const out = path.join(CASES_ROOT, 'accuracy')
  mkdirSync(out, { recursive: true })
  for (const [table, rows] of Object.entries(toCsvTables(scoreCases(scored), caseNumberOf))) {
    writeFileSync(path.join(out, `${table}.csv`), toCsv(rows))
    console.log(`${table}.csv — ${rows.length} wierszy`)
  }
  console.log(
    `Przypadki: ${scored.map((input) => caseNumberOf.get(input.investmentId)).join(', ')}`,
  )
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
