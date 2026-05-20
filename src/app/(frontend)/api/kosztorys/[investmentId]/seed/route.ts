import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { putWorkbook, workbookExists } from '@/lib/kosztorys/blob'
import type { IWorkbookDataT } from '@/lib/kosztorys/types'

/**
 * POST /api/kosztorys/[investmentId]/seed
 *
 * Copies the default kosztorys template (public/data/kosztorys-workbook.json)
 * to Blob storage keyed by investmentId. No-op if a workbook already exists
 * for this investment unless ?force=1 is passed.
 *
 * Spike-only: the template path assumes the converter script has been run
 * locally. Production seeding will need a different mechanism (e.g. a copy
 * of a master template stored in Blob).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ investmentId: string }> },
) {
  const user = await getCurrentUserJwt()
  if (!user || !MANAGEMENT_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 401 })
  }

  const { investmentId } = await params
  const id = Number(investmentId)
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid investmentId' }, { status: 400 })
  }

  const url = new URL(request.url)
  const force = url.searchParams.get('force') === '1'

  try {
    if (!force && (await workbookExists(id))) {
      return NextResponse.json(
        { ok: false, reason: 'already-exists', hint: 'pass ?force=1 to overwrite' },
        { status: 409 },
      )
    }

    const templatePath = join(process.cwd(), 'public', 'data', 'kosztorys-workbook.json')
    const raw = await readFile(templatePath, 'utf-8')
    const workbook = JSON.parse(raw) as IWorkbookDataT

    // bind the template's metadata to this investment for clarity
    workbook.id = `kosztorys-${id}`
    workbook.name = `Kosztorys — investment #${id}`

    const { url: blobUrl } = await putWorkbook(id, workbook)
    return NextResponse.json({ ok: true, blobUrl, investmentId: id })
  } catch (err) {
    console.error('[kosztorys/seed] POST failed:', err)
    const msg = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
