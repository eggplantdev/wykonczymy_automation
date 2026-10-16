import { google, type sheets_v4 } from 'googleapis'
import {
  createServiceAccountJWT,
  createWriteServiceAccountJWT,
  hasWriteServiceAccountCredentials,
} from '@/lib/google/auth'

const READONLY_SCOPE = ['https://www.googleapis.com/auth/spreadsheets.readonly']

// production has always required exactly ONE share per sheet, and reading with the Viewer account would silently make every sheet need a second one.
export function getReadonlySheetsClient(): sheets_v4.Sheets {
  const auth = hasWriteServiceAccountCredentials()
    ? createWriteServiceAccountJWT(READONLY_SCOPE)
    : createServiceAccountJWT(READONLY_SCOPE)
  return google.sheets({ version: 'v4', auth })
}
