import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getDb } from '@/lib/db/get-db'
import { lockInvestmentForReplace } from '@/lib/db/lock-investment-for-replace'
import { insertSnapshot } from '@/lib/db/snapshots'
import { retryOnConcurrentWrite, withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { listCatalogueIdentitiesByMatchKey } from '@/lib/db/work-catalogue'
import { getInvestmentSheet } from '@/lib/google/sheet-lookup'
import { restoreKosztorys } from '@/lib/kosztorys/restore-kosztorys'
import { serializeTree } from '@/lib/kosztorys/serialize-tree'
import { buildImportPlan } from '@/lib/kosztorys/sheet-import/build-import-plan'
import {
  LABOR_TAB,
  pickImportTabs,
  type ImportGridsT,
} from '@/lib/kosztorys/sheet-import/read-sheet'
import { buildKosztorysTree } from '@/lib/queries/kosztorys'

type XlsxTabT = { title: string; values: unknown[][]; formulas: unknown[][] }

const USAGE =
  'użycie (wymaga python3 z openpyxl):\n' +
  '  INV=<id> FILE=<plik.xlsx> BY=<e-mail> node --env-file=.env --conditions=react-server \\\n' +
  '    --import tsx src/scripts/import-kosztorys-xlsx.ts [--apply]\n' +
  'prod: set -a; source .env; set +a; DB_POSTGRES_URL="$DB_POSTGRES_URL_PROD" INV=… (jak wyżej)'

const INVESTMENT_ID = Number(process.env.INV)
const FILE = process.env.FILE
const BY = process.env.BY
const APPLY = process.argv.includes('--apply')
const SNAPSHOT_LABEL = 'Przed importem z pliku xlsx'
const XLSX_TO_GRIDS = path.resolve(import.meta.dirname, '../../scripts/xlsx-to-grids.py')

if (!INVESTMENT_ID || !FILE || !BY || !process.env.DB_POSTGRES_URL) throw new Error(USAGE)

function readGrids(file: string): ImportGridsT {
  const tabs: XlsxTabT[] = JSON.parse(
    execFileSync('python3', ['-I', XLSX_TO_GRIDS, file], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    }),
  )
  const byTitle = new Map(tabs.map((tab) => [tab.title, tab]))
  const { laborTabTitle, rateTitles } = pickImportTabs(tabs.map((tab) => tab.title))
  const labor = laborTabTitle ? byTitle.get(laborTabTitle) : undefined
  if (!labor) throw new Error(`${file} nie ma zakładki „${LABOR_TAB}"`)
  return {
    laborGrid: labor.values,
    laborTabGid: undefined,
    laborGridFormulas: labor.formulas,
    rateTabs: rateTitles.flatMap((title) => {
      const tab = byTitle.get(title)
      return tab ? [{ title, grid: tab.values, formulas: tab.formulas }] : []
    }),
  }
}

async function run() {
  const grids = readGrids(FILE as string)
  const payload = await getPayload({ config })
  const db = await getDb(payload)

  const {
    docs: [user],
  } = await payload.find({ collection: 'users', where: { email: { equals: BY } }, limit: 1 })
  if (!user) throw new Error(`No user ${BY}`)

  const plan = buildImportPlan(
    grids,
    serializeTree(await buildKosztorysTree(INVESTMENT_ID)),
    (await getInvestmentSheet(payload, INVESTMENT_ID))?.sheetColumnMapping,
    undefined,
    await listCatalogueIdentitiesByMatchKey(db),
  )
  if (!plan.ok) throw new Error(plan.problems.join(' '))

  const { report } = plan
  console.log(
    `DB ${new URL(process.env.DB_POSTGRES_URL as string).hostname} · inv ${INVESTMENT_ID}`,
  )
  console.log('counts', report.counts, 'coeffs', report.coeffs)
  console.log(
    'missingColumns',
    report.missingColumns.map((column) => column.label),
  )
  console.log('rateDecisions', report.rateDecisions.length, 'dropped', report.dropped.length)
  for (const decision of report.rateDecisions) {
    console.log(
      ' ',
      decision.kind,
      decision.conflictReason ?? '',
      decision.description,
      decision.candidates ?? '',
    )
  }
  console.log('totals', report.totals)
  console.log('warnings', report.warnings)

  if (!APPLY) {
    console.log('Dry run — add --apply to write.')
    process.exit(0)
  }

  // Not `replaceTreeWithSnapshot`: its `serializeKosztorys` read runs a session check that throws in a
  // script with no request.
  await retryOnConcurrentWrite(
    () =>
      withPayloadTransaction(
        payload,
        async (req) => {
          const txDb = await getDb(payload, req)
          await lockInvestmentForReplace(txDb, INVESTMENT_ID)
          await insertSnapshot(txDb, {
            investmentId: INVESTMENT_ID,
            kind: 'manual',
            label: SNAPSHOT_LABEL,
            takenBy: user.id,
            payload: serializeTree(await buildKosztorysTree(INVESTMENT_ID, req)),
          })
          return restoreKosztorys(payload, req, INVESTMENT_ID, plan.tree)
        },
        { skipRevalidation: true },
        { isolationLevel: 'repeatable read' },
      ),
    {
      logLabel: 'import-kosztorys-xlsx',
      failedMessage: 'Import przerwany przez równoległy zapis.',
    },
  )

  const written = await buildKosztorysTree(INVESTMENT_ID)
  console.log(
    `Zapisane: ${written.sections.length} sekcji, ${written.stages.length} etapów, ${written.progress.length} wpisów postępu`,
  )
  process.exit(0)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
