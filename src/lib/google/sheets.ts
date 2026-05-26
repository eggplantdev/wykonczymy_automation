import { google, sheets_v4 } from 'googleapis'
import { createServiceAccountJWT } from './auth'

export type MaterialKindT = 'budowlane' | 'wykończeniowe'

export type AppendMaterialInputT = {
  kind: MaterialKindT
  amount: number
  description: string
  transferId: number
  date: string
}

const MATERIALY_TAB = 'materiały '
const VALUE_COLUMNS: Record<MaterialKindT, string> = {
  budowlane: 'B:C',
  wykończeniowe: 'F:G',
}
const TRANSFER_ID_COLUMN = 'I'

function getClient(): sheets_v4.Sheets {
  const auth = createServiceAccountJWT(['https://www.googleapis.com/auth/spreadsheets'])
  return google.sheets({ version: 'v4', auth })
}

function parseRowFromRange(range: string): number {
  const match = range.match(/!([A-Z]+)(\d+):/)
  if (!match) throw new Error(`could not parse row from range: ${range}`)
  return Number(match[2])
}

export async function appendMaterialRow(
  spreadsheetId: string,
  input: AppendMaterialInputT,
): Promise<{ rowIndex: number }> {
  const sheets = getClient()
  const valueRange = `'${MATERIALY_TAB}'!${VALUE_COLUMNS[input.kind]}`
  const descWithDate = `${input.description} [${input.date}]`

  const appendRes = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: valueRange,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [[input.amount, descWithDate]] },
  })

  const updatedRange = appendRes.data.updates?.updatedRange
  if (!updatedRange) throw new Error('append response missing updatedRange')
  const rowIndex = parseRowFromRange(updatedRange)

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${MATERIALY_TAB}'!${TRANSFER_ID_COLUMN}${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[input.transferId]] },
  })

  return { rowIndex }
}

export async function readMaterialyTransferIds(
  spreadsheetId: string,
): Promise<Map<number, number>> {
  const sheets = getClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${MATERIALY_TAB}'!${TRANSFER_ID_COLUMN}:${TRANSFER_ID_COLUMN}`,
  })

  const map = new Map<number, number>()
  const values = res.data.values ?? []
  for (let i = 0; i < values.length; i++) {
    const cell = values[i]?.[0]
    if (cell == null) continue
    const trimmed = String(cell).trim()
    if (trimmed === '') continue
    const id = Number(trimmed)
    if (Number.isFinite(id)) map.set(id, i + 1)
  }
  return map
}

export async function deleteMaterialRowByTransferId(
  spreadsheetId: string,
  transferId: number,
): Promise<{ deleted: boolean; rowIndex?: number }> {
  const sheets = getClient()

  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  const materialy = meta.data.sheets?.find((s) => s.properties?.title === MATERIALY_TAB)
  if (!materialy?.properties || materialy.properties.sheetId == null) {
    throw new Error(`materiały tab not found on ${spreadsheetId}`)
  }
  const sheetId = materialy.properties.sheetId

  const map = await readMaterialyTransferIds(spreadsheetId)
  const rowIndex = map.get(transferId)
  if (!rowIndex) return { deleted: false }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1,
              endIndex: rowIndex,
            },
          },
        },
      ],
    },
  })

  return { deleted: true, rowIndex }
}
