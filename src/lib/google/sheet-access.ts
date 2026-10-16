import { hasWriteServiceAccountCredentials, parseServiceAccountCredentials } from './auth'
import { logError } from '@/lib/utils/log-error'
import { getReadonlySheetsClient } from './readonly-sheets-client'
import { getWritableSheetsClient } from './writable-sheets-client'

export function serviceAccountEmail(): string {
  // The credential JSON is cast, not validated, so a malformed one yields `undefined` behind a
  // `string` type — and the dialog would print „udostępnij arkusz kontu undefined".
  return parseServiceAccountCredentials().client_email ?? ''
}

export function extractSheetId(input: string): string | undefined {
  const trimmed = input.trim()
  const fromUrl = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (fromUrl) return fromUrl[1]
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed
  return undefined
}

// A read-only probe would pass a Viewer-only share at link time, then 403 on first sync.
export async function verifySheetAccess(spreadsheetId: string): Promise<{ title: string } | null> {
  try {
    const res = await getReadonlySheetsClient().spreadsheets.get({
      spreadsheetId,
      fields: 'properties.title',
    })
    const title = res.data.properties?.title ?? ''

    if (!hasWriteServiceAccountCredentials()) {
      logError(
        `[sheet-access] write probe skipped for ${spreadsheetId} — no Editor credential outside production`,
      )
      return { title }
    }

    await getWritableSheetsClient().spreadsheets.batchUpdate({
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
