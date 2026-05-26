import { google, drive_v3 } from 'googleapis'
import { createServiceAccountJWT } from './auth'

function getDriveClient(): drive_v3.Drive {
  const auth = createServiceAccountJWT(['https://www.googleapis.com/auth/drive.file'])
  return google.drive({ version: 'v3', auth })
}

export async function createKosztorysFromTemplate(
  investmentName: string,
): Promise<{ sheetId: string }> {
  const templateId = process.env.KOSZTORYS_TEMPLATE_SHEET_ID
  if (!templateId) throw new Error('KOSZTORYS_TEMPLATE_SHEET_ID not set')

  const drive = getDriveClient()
  const folderId = process.env.KOSZTORYS_DRIVE_FOLDER_ID

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
