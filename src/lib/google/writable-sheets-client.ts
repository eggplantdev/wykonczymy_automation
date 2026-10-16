import { google, type sheets_v4 } from 'googleapis'
import { createWriteServiceAccountJWT } from '@/lib/google/auth'

export function getWritableSheetsClient(): sheets_v4.Sheets {
  const auth = createWriteServiceAccountJWT(['https://www.googleapis.com/auth/spreadsheets'])
  return google.sheets({ version: 'v4', auth })
}
