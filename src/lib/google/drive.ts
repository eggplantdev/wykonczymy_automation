import { google, drive_v3 } from 'googleapis'
import { createServiceAccountJWT } from './auth'
import { serverEnv } from '@/lib/env.server'

function getDriveClient(): drive_v3.Drive {
  const auth = createServiceAccountJWT(['https://www.googleapis.com/auth/drive.file'])
  return google.drive({ version: 'v3', auth })
}

export async function createSheetFromTemplate(
  investmentName: string,
): Promise<{ sheetId: string }> {
  const templateId = serverEnv.KOSZTORYS_TEMPLATE_SHEET_ID

  const drive = getDriveClient()
  const folderId = serverEnv.KOSZTORYS_DRIVE_FOLDER_ID

  const copy = await drive.files.copy({
    fileId: templateId,
    requestBody: {
      name: `Kosztorys – ${investmentName}`,
      ...(folderId ? { parents: [folderId] } : {}),
    },
    fields: 'id',
  })

  if (!copy.data.id) throw new Error('Drive returned no file id')
  return { sheetId: copy.data.id }
}

// True when a Drive error means the service account is out of storage. Matches the
// STRUCTURED reason `storageQuotaExceeded` (Google's contractual error code) rather
// than a substring of its localizable message text; falls back to a message match
// only as a last resort.
export function isStorageQuotaError(err: unknown): boolean {
  const e = err as {
    errors?: Array<{ reason?: string }>
    response?: { data?: { error?: { errors?: Array<{ reason?: string }> } } }
    message?: string
  }
  const reasons = [...(e?.errors ?? []), ...(e?.response?.data?.error?.errors ?? [])].map(
    (r) => r?.reason,
  )
  if (reasons.includes('storageQuotaExceeded')) return true
  return /storage\s*quota/i.test(String(e?.message ?? err))
}
