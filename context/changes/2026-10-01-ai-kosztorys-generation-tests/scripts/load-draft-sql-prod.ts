// Loads a case's AI przedmiar draft into its PRODUCTION kosztorys in ONE transaction, instead of ~400
// sequential Payload round trips to Neon. The only hook on kosztorys-items is cache revalidation,
// which `touch-kosztorys-prod.ts` does afterwards. Ask the user before every run.
//
// The statements name only the AI columns (ai_planned_qty / ai_missing_data / ai_assumptions) on an
// existing pozycja, so no owner field can be written. Matching reads production through the app; only
// the write goes to the database. A draft row whose sekcja is missing stops the run before any write.
//   TOKEN_FILE=… CASE=18-<slug> [DRY=1] node --env-file=.env --import tsx \
//     context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/load-draft-sql-prod.ts
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { sectionItemKey } from '@/lib/kosztorys/sheet-import/item-key'
import { api, itemsOf } from './prod-client'

type DraftRowT = {
  section: string
  description: string
  qty: number
  unit?: string
  clientPrice?: number
  missingData?: string
  assumptions?: string
}

const DRY = process.env.DRY === '1'
const CASE_DIR = path.join(import.meta.dirname, '../cases', process.env.CASE ?? '')

const text = (value: string | null | undefined) =>
  value == null ? 'NULL' : `'${value.replace(/'/g, "''")}'`
function num(value: number) {
  if (!Number.isFinite(value)) throw new Error(`not a number: ${value}`)
  return String(value)
}

async function run() {
  const kase = JSON.parse(readFileSync(path.join(CASE_DIR, 'case.json'), 'utf8'))
  const investmentId: number = kase.investmentId
  const draft: DraftRowT[] = JSON.parse(readFileSync(path.join(CASE_DIR, kase.draft), 'utf8'))
  const rowByKey = new Map(draft.map((row) => [sectionItemKey(row.section, row.description), row]))

  const items = await itemsOf(investmentId)
  if (!items.length)
    throw new Error(`#${investmentId} has no kosztorys — run fill-case-prod.ts first`)
  const { docs: sections } = await api<{ docs: { id: number; name: string }[] }>(
    `/kosztorys-sections?where[investment][equals]=${investmentId}&limit=0&pagination=false&depth=0`,
  )
  const sectionByKey = new Map(sections.map((s) => [sectionItemKey(s.name, null), s]))

  const matchedKeys = new Set<string>()
  const lastOrderBySection = new Map<number, number>()
  const updates = items.map((item) => {
    const key = sectionItemKey(item.section.name, item.description)
    const row = rowByKey.get(key)
    if (row) matchedKeys.add(key)
    const last = lastOrderBySection.get(item.section.id) ?? 0
    lastOrderBySection.set(item.section.id, Math.max(last, item.displayOrder))
    return `(${item.id}, ${num(row?.qty ?? 0)}::numeric, ${text(row?.missingData)}::varchar, ${text(row?.assumptions)}::varchar)`
  })

  const added = draft.filter(
    (row) => !matchedKeys.has(sectionItemKey(row.section, row.description)),
  )
  const withoutSection = added.filter((row) => !sectionByKey.has(sectionItemKey(row.section, null)))
  if (withoutSection.length) {
    throw new Error(
      `no sekcja for: ${withoutSection.map((r) => `${r.section} | ${r.description}`).join('; ')}`,
    )
  }
  const inserts = added.map((row) => {
    const sectionId = sectionByKey.get(sectionItemKey(row.section, null))!.id
    const displayOrder = (lastOrderBySection.get(sectionId) ?? 0) + 1
    lastOrderBySection.set(sectionId, displayOrder)
    return `(${investmentId}, ${sectionId}, ${displayOrder}, ${text(row.description)}, ${text(row.unit)}, ${num(row.clientPrice ?? 0)}, 0, 0, ${num(row.qty)}, ${text(row.missingData)}, ${text(row.assumptions)})`
  })

  const sql = [
    `UPDATE kosztorys_items k
       SET ai_planned_qty = v.qty, ai_missing_data = v.missing, ai_assumptions = v.assumptions, updated_at = now()
       FROM (VALUES\n${updates.join(',\n')}) AS v(id, qty, missing, assumptions)
       WHERE k.id = v.id AND k.investment_id = ${investmentId};`,
    inserts.length
      ? `INSERT INTO kosztorys_items (investment_id, section_id, display_order, description, unit,
           client_price, planned_qty, discount_value, ai_planned_qty, ai_missing_data, ai_assumptions)
         VALUES\n${inserts.join(',\n')};`
      : '',
    `UPDATE investments SET ai_stage = 'analyzed', updated_at = now() WHERE id = ${investmentId};`,
  ].join('\n')

  const total = draft.reduce((sum, row) => {
    const item = items.find(
      (i) =>
        sectionItemKey(i.section.name, i.description) ===
        sectionItemKey(row.section, row.description),
    )
    return sum + row.qty * (item?.clientPrice ?? row.clientPrice ?? 0)
  }, 0)
  console.log(
    `#${investmentId}: ${items.length} pozycji, ${matchedKeys.size}/${draft.length} wierszy szkicu dopasowanych, ${inserts.length} do dodania; expected AI przedmiar ${total.toFixed(2)} zł`,
  )
  const file = path.join(tmpdir(), `load-draft-${investmentId}.sql`)
  writeFileSync(file, sql)
  if (DRY) return console.log(`DRY — SQL in ${file}`)

  const url = process.env.DB_POSTGRES_URL_PROD
  if (!url) throw new Error('DB_POSTGRES_URL_PROD missing')
  const out = execFileSync('psql', [url, '-X', '-1', '-v', 'ON_ERROR_STOP=1', '-f', file], {
    encoding: 'utf8',
  })
  console.log(out.trim())
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
