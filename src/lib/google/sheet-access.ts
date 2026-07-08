import { google } from 'googleapis'
import { createServiceAccountJWT } from './auth'
import { serverEnv } from '@/lib/env/server'

// The service-account email — what an owner must share a sheet with for the app
// to read/sync it. Parsed from the same credential JSON the clients use.
export function serviceAccountEmail(): string {
  return (
    (JSON.parse(serverEnv.GOOGLE_SERVICE_ACCOUNT_JSON) as { client_email?: string }).client_email ??
    ''
  )
}

// Pull the spreadsheet id out of a pasted Google Sheets URL, or accept a raw id.
// Returns undefined when the input is neither.
export function extractSheetId(input: string): string | undefined {
  const trimmed = input.trim()
  const fromUrl = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (fromUrl) return fromUrl[1]
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed
  return undefined
}

// Confirm the service account can actually EDIT the sheet, returning its title.
// Returns null when it can't — the caller turns that into a "share it with … as
// Editor" message rather than leaking the raw API error.
//
// We must verify write access, not just read: the sync (stampAllTabs, which
// calls setupTab / applyTabRowsBatch) needs Editor. A read-only probe would pass a Viewer-only
// share at link time, then 403 on first sync. So after reading the title we run a
// no-op write (rewrite the title to itself) under the full `spreadsheets` scope —
// a Viewer share can read but not write, so this surfaces the gap now.
export async function verifySheetAccess(spreadsheetId: string): Promise<{ title: string } | null> {
  const auth = createServiceAccountJWT(['https://www.googleapis.com/auth/spreadsheets'])
  const sheets = google.sheets({ version: 'v4', auth })
  try {
    const res = await sheets.spreadsheets.get({ spreadsheetId, fields: 'properties.title' })
    const title = res.data.properties?.title ?? ''
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ updateSpreadsheetProperties: { properties: { title }, fields: 'title' } }],
      },
    })
    return { title }
  } catch {
    return null
  }
}
