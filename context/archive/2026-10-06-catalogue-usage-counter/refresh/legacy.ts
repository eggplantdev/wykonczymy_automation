import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseLaborTab } from '@/lib/kosztorys/sheet-import/parse-labor-tab'
import { resolveLaborColumns } from '@/lib/kosztorys/sheet-import/resolve-columns'
import { parseSheetColumnMapping } from '@/lib/kosztorys/sheet-import/sheet-column-mapping'
import { LEGACY_SOURCE_PREFIX } from './sources'

// The app-side count misses two things an old Google sheet still holds: the prace of an investment
// whose kosztorys was never brought into the app, and the rows of an imported one that the app's
// copy lacks — measured 2026-10-06, 27 such sheets carry 515 used pozycje their app kosztorys does
// not, under 103 names found nowhere else. So every dump of a live investment is read
// (context/reference/legacy-sheet-dumps.md), into the same row shape as items.tsv; template.ts
// counts an investment once however many copies of its kosztorys name the praca.
const [out] = process.argv.slice(2)
const dir =
  process.env.LEGACY_SHEET_DUMP_DIR ?? join(homedir(), '.local/share/wykonczymy-legacy-sheets')

const investmentIds = (file: string) =>
  readFileSync(`${out}/${file}`, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t')[0])
// Both exports are already cut to live investments (no szablon, no kosz).
const eligible = new Set([...investmentIds('no-kosztorys.tsv'), ...investmentIds('items.tsv')])
const clean = (text: string) => text.replace(/[\t\n\r]/g, ' ')
const lines: string[] = []
const sheets: string[] = []
const skipped: string[] = []
for (const file of existsSync(dir)
  ? readdirSync(dir).filter((name) => name.endsWith('.json'))
  : []) {
  const dump = JSON.parse(readFileSync(join(dir, file), 'utf8'))
  if (!eligible.has(String(dump.investmentId))) continue
  const resolved = dump.grids
    ? resolveLaborColumns(dump.grids.laborGrid, parseSheetColumnMapping(dump.columnMapping))
    : undefined
  if (!dump.grids || !resolved?.ok) {
    skipped.push(dump.sheetName.trim())
    continue
  }
  const parsed = parseLaborTab(dump.grids.laborGrid, resolved, dump.grids.laborGridFormulas)
  const doneByItem = new Map<number, number>()
  for (const entry of parsed.progress)
    if (entry.qtyDone > 0)
      doneByItem.set(entry.itemId, (doneByItem.get(entry.itemId) ?? 0) + entry.qtyDone)
  for (const item of parsed.items) {
    const description = clean(item.description ?? '').trim()
    if (!description) continue
    lines.push(
      [
        `${LEGACY_SOURCE_PREFIX}${dump.investmentId}`,
        'f',
        description,
        clean(item.unit ?? ''),
        item.plannedQty,
        doneByItem.get(item.id) ?? 0,
      ].join('\t'),
    )
  }
  sheets.push(`${dump.investmentId}\t${clean(dump.sheetName).trim()}`)
}
writeFileSync(`${out}/legacy-items.tsv`, lines.join('\n'))
writeFileSync(`${out}/legacy-sheets.tsv`, sheets.join('\n'))
console.error(
  `stare arkusze: ${sheets.length} przeczytanych, ${lines.length} pozycji` +
    (skipped.length ? `; nieprzeczytane: ${skipped.join(', ')}` : '') +
    (existsSync(dir) ? '' : ` — BRAK katalogu zrzutów ${dir}`),
)
