import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@payload-config'
import { readWorkerReportPage } from '@/lib/ai/worker-report-scan'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { getDb } from '@/lib/db/get-db'
import { readReportTarget } from '@/lib/db/worker-report-share'
import { DEFAULT_LANGUAGE } from '@/lib/i18n/languages'
import { reportUnits, treeItems } from '@/lib/kosztorys/worker-report/report-lines'
import { scanUnits } from '@/lib/kosztorys/worker-report/scan-units'
import { buildKosztorysTree } from '@/lib/queries/kosztorys'
import { logError } from '@/lib/utils/log-error'

/**
 * Reads ONE photo of a filled „Drukuj do wypełnienia" form. Persists nothing — the dialog sends every
 * page's result to `createScannedReportAction` together with the uploaded photos.
 *
 * An API route for the same reason as `extract-receipt`: a phone photo blows past the server-action
 * body cap as an uncatchable 413.
 */

// Primary + fallback attempt of RECEIPT_TIMEOUT_MS each, with room to spare.
export const maxDuration = 300

const ACCEPTED_TYPE = /^image\//

const formIdSchema = z.coerce.number().int().positive()

export async function POST(request: Request) {
  const auth = await requireAuth(MANAGEMENT_ROLES)
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 })

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Brak zdjęcia' }, { status: 400 })
    }
    if (!ACCEPTED_TYPE.test(file.type)) {
      return NextResponse.json({ error: 'Kartkę wczytuje się ze zdjęcia' }, { status: 400 })
    }
    const investmentId = formIdSchema.safeParse(formData.get('investmentId'))
    const workerId = formIdSchema.safeParse(formData.get('workerId'))
    if (!investmentId.success || !workerId.success) {
      return NextResponse.json({ error: 'Nieprawidłowe zgłoszenie' }, { status: 400 })
    }

    const db = await getDb(await getPayload({ config }))
    const target = await readReportTarget(db, investmentId.data, workerId.data)
    if (!target) {
      return NextResponse.json(
        { error: 'Pracownik nie ma etapu na tej inwestycji.' },
        { status: 400 },
      )
    }
    const tree = await buildKosztorysTree(investmentId.data)
    const units = scanUnits(reportUnits(treeItems(tree)), target.language ?? DEFAULT_LANGUAGE)

    const page = {
      bytes: new Uint8Array(await file.arrayBuffer()),
      mediaType: file.type,
      filename: file.name || `kartka.${file.type.split('/')[1]}`,
    }
    return NextResponse.json({ data: await readWorkerReportPage(page, { units }) })
  } catch (err) {
    // TODO(EX-449) SENTRY-REQUIRED: a failed paper read is a silent provider error the kierownik
    // can't self-report.
    logError('[read-worker-report] Read failed:', err)
    const message = err instanceof Error ? err.message : 'Błąd odczytu kartki'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
