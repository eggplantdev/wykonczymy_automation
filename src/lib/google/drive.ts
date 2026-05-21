import { google, drive_v3 } from 'googleapis'

function getDriveClient(): drive_v3.Drive {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set')
  const creds = JSON.parse(raw) as { client_email: string; private_key: string }
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  })
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
