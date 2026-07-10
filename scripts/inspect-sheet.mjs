import { google } from 'googleapis'

// Read-only deep inspection of a kosztorys sheet: dumps BOTH formulas and
// formatted values, full rows (not capped at 60), with correct column letters
// past Z. One-off analysis tool for the in-app-kosztorys POC design.
//
//   SHEET_ID=<id> [MAX_ROWS=400] [TABS="wydatki,transfery"] \
//     node --env-file=./.env scripts/inspect-sheet.mjs > /tmp/dump.txt

const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set')
const creds = JSON.parse(raw)

const auth = new google.auth.JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
})
const sheets = google.sheets({ version: 'v4', auth })

const spreadsheetId = process.env.SHEET_ID || process.env.KOSZTORYS_TEMPLATE_SHEET_ID
if (!spreadsheetId) throw new Error('SHEET_ID not set')
const MAX_ROWS = Number(process.env.MAX_ROWS || 400)
const tabFilter = (process.env.TABS || '')
  .split(',')
  .map((t) => t.trim().toLowerCase())
  .filter(Boolean)

const colLetter = (idx) => {
  let s = ''
  let n = idx + 1
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

const meta = await sheets.spreadsheets.get({
  spreadsheetId,
  fields: 'properties.title,sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)),merges)',
})

console.log('FILE:', meta.data.properties?.title)
console.log('TABS:')
for (const s of meta.data.sheets ?? []) {
  const p = s.properties
  console.log(
    `  - "${p?.title}"  gid=${p?.sheetId}  rows=${p?.gridProperties?.rowCount}  cols=${p?.gridProperties?.columnCount}  merges=${s.merges?.length ?? 0}`,
  )
}

const wanted = (meta.data.sheets ?? []).filter(
  (s) => !tabFilter.length || tabFilter.some((t) => (s.properties?.title || '').toLowerCase().includes(t)),
)

const compactRow = (row, i) => {
  const cells = (row ?? [])
    .map((c, idx) => (c !== '' && c != null ? `${colLetter(idx)}=${String(c).slice(0, 60)}` : null))
    .filter(Boolean)
  return cells.length ? `r${String(i + 1).padStart(2, '0')}: ${cells.join('  |  ')}` : null
}

for (const s of wanted) {
  const title = s.properties?.title
  const lastRow = Math.min(MAX_ROWS, s.properties?.gridProperties?.rowCount || MAX_ROWS)
  const range = `'${title}'!A1:BZ${lastRow}`

  const [valsRes, formsRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range, valueRenderOption: 'FORMATTED_VALUE' }),
    sheets.spreadsheets.values.get({ spreadsheetId, range, valueRenderOption: 'FORMULA' }),
  ])
  const vals = valsRes.data.values ?? []
  const forms = formsRes.data.values ?? []

  console.log('\n========================================')
  console.log('TAB:', title, ` (formatted | formula)`)
  console.log('========================================')

  console.log('--- FORMATTED VALUES ---')
  vals.forEach((row, i) => {
    const line = compactRow(row, i)
    if (line) console.log(line)
  })

  console.log('--- FORMULAS (only cells that start with "=") ---')
  forms.forEach((row, i) => {
    const cells = (row ?? [])
      .map((c, idx) => (typeof c === 'string' && c.startsWith('=') ? `${colLetter(idx)}=${c.slice(0, 80)}` : null))
      .filter(Boolean)
    if (cells.length) console.log(`r${String(i + 1).padStart(2, '0')}: ${cells.join('  |  ')}`)
  })
}
