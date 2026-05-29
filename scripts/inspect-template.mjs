import { google } from 'googleapis'

const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set')
const creds = JSON.parse(raw)

const auth = new google.auth.JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
})

const sheets = google.sheets({ version: 'v4', auth })
const spreadsheetId = process.env.KOSZTORYS_TEMPLATE_SHEET_ID
if (!spreadsheetId) throw new Error('KOSZTORYS_TEMPLATE_SHEET_ID not set')

const meta = await sheets.spreadsheets.get({
  spreadsheetId,
  fields: 'properties.title,sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)),merges)',
})

console.log('FILE:', meta.data.properties?.title)
console.log('TABS:')
for (const s of meta.data.sheets ?? []) {
  const p = s.properties
  console.log(`  - "${p?.title}"  gid=${p?.sheetId}  rows=${p?.gridProperties?.rowCount}  cols=${p?.gridProperties?.columnCount}  merges=${s.merges?.length ?? 0}`)
}

// Dump first 60 rows × all cols of every tab so we can see the structure.
const ranges = (meta.data.sheets ?? []).map((s) => `'${s.properties?.title}'!A1:AZ60`)
const batch = await sheets.spreadsheets.values.batchGet({
  spreadsheetId,
  ranges,
  valueRenderOption: 'FORMATTED_VALUE',
})

for (const vr of batch.data.valueRanges ?? []) {
  console.log('\n========================================')
  console.log('RANGE:', vr.range)
  console.log('========================================')
  const grid = vr.values ?? []
  grid.forEach((row, i) => {
    // print row index and non-empty cell map
    const compact = row
      .map((c, idx) => (c !== '' && c != null ? `${String.fromCharCode(65 + idx)}=${String(c).slice(0, 40)}` : null))
      .filter(Boolean)
      .join('  |  ')
    if (compact) console.log(`r${(i + 1).toString().padStart(2, '0')}: ${compact}`)
  })
}
