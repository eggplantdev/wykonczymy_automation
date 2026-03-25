import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { uploadFile } from '@/lib/upload-file'

/**
 * POST /api/upload-file
 * Accepts FormData with a single 'file' field.
 * Returns { mediaId } on success.
 *
 * Uses an API route (not a server action) to avoid the server action body size limit.
 * Client-side compression reduces file size before upload, but this route
 * has no artificial cap — PDFs and edge cases pass through without issues.
 */
export async function POST(request: Request) {
  const user = await getCurrentUserJwt()
  if (!user || !MANAGEMENT_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'Brak pliku' }, { status: 400 })
    }

    const payload = await getPayload({ config })
    const mediaId = await uploadFile(payload, file)

    return NextResponse.json({ mediaId })
  } catch (err) {
    console.error('[upload-file] Upload failed:', err)
    const message = err instanceof Error ? err.message : 'Upload nie powiódł się'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
