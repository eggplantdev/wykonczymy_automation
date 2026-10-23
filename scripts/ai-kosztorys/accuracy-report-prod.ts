// Read-only: the dashboard's five CSVs into <ai-cases>/accuracy/, from every owner-reviewed case.
//   TOKEN_FILE=… node --import tsx scripts/ai-kosztorys/accuracy-report-prod.ts
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { scoreCases, toCsv, type CaseInputT } from './accuracy'
import { api, CASES_ROOT, itemsOf } from './prod-client'

const REVIEWED = new Set(['review_done', 'knowledge_extracted'])

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
  const { docs } = await api<{ docs: { id: number; aiStage: string | null }[] }>(
    '/investments?depth=0&pagination=false&select[aiStage]=true',
  )
  const stageOf = new Map(docs.map((doc) => [doc.id, doc.aiStage]))

  const scored: CaseInputT[] = []
  for (const file of caseFiles()) {
    if (file.accuracyExcluded) continue
    if (!stageOf.has(file.investmentId))
      throw new Error(`case ${file.caseNumber}: investment ${file.investmentId} not in production`)
    if (!REVIEWED.has(stageOf.get(file.investmentId) ?? '')) continue
    const items = await itemsOf(file.investmentId)
    if (!items.some((item) => item.aiPlannedQty !== null)) continue
    scored.push({ ...file, items })
  }

  const out = path.join(CASES_ROOT, 'accuracy')
  mkdirSync(out, { recursive: true })
  for (const [table, rows] of Object.entries(scoreCases(scored))) {
    writeFileSync(path.join(out, `${table}.csv`), toCsv(rows))
    console.log(`${table}.csv — ${rows.length} wierszy`)
  }
  console.log(`Przypadki: ${scored.map((input) => input.caseNumber).join(', ')}`)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
