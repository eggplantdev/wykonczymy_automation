//   SHEETS="<id>,<id>" node --env-file=.env --import tsx src/scripts/check-column-resolution.ts
import { google } from 'googleapis'
import { readImportGrids } from '@/lib/kosztorys/sheet-import/read-sheet'
import { resolveRates, resolveLaborColumns } from '@/lib/kosztorys/sheet-import/resolve-columns'

// Raw `process.env` rather than the validated layer: its `server-only` guard makes anything
// importing it unusable from a tsx script.
const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON as string)
const ids = (process.env.SHEETS ?? '').split(',').filter(Boolean)

const sheets = google.sheets({
  version: 'v4',
  auth: new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  }),
})

const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const letter = (index: number): string =>
  index < 26 ? A[index] : A[Math.floor(index / 26) - 1] + A[index % 26]

for (const spreadsheetId of ids) {
  console.log(`\n=== ${spreadsheetId}`)
  const { laborGrid, rateTabs } = await readImportGrids(sheets, spreadsheetId)

  const resolved = resolveLaborColumns(laborGrid)
  if (!resolved.ok) {
    console.log('  kosztorys_robocizny: FAIL —', resolved.problems.join(' | '))
  } else {
    const show = Object.entries(resolved.columns)
      .map(([field, index]) => `${field}=${letter(index as number)}`)
      .join(' ')
    console.log(
      `  kosztorys_robocizny: ${show} stages=${letter(resolved.stages.firstColumn)}×${resolved.stages.count} rows=${laborGrid.length}`,
    )
  }

  for (const { title, grid } of rateTabs) {
    const rates = resolveRates(grid)
    if (!rates.ok) {
      console.log(`  "${title}": FAIL —`, rates.problems.join(' | '))
      continue
    }
    const { wToolsRate, ownToolsRate, description } = rates.columns
    console.log(
      `  "${title}": opis=${letter(description)} zNarz=${letter(wToolsRate)} bezNarz=${letter(ownToolsRate)} rows=${grid.length}`,
    )
  }
}
