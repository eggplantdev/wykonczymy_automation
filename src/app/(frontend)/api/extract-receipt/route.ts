import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { scanReceipt } from '@/lib/ai/scan-receipt'
import { MAX_RECEIPT_PAGES } from '@/lib/constants/receipt-scan'
import { isAllowedUploadMime } from '@/lib/media/sniff-mime'
import { logError } from '@/lib/utils/log-error'

/**
 * An API route, not a server action: a multi-page scan blows past the server-action body cap,
 * which surfaces as an uncatchable 413 rather than an error the form can report.
 */

// Must cover the worst-case scan budget in openrouter.ts (primary + fallback attempt), or the
// platform kills the invocation before the AbortController can report a clean timeout.
export const maxDuration = 300

const categoryNamesSchema = z.array(z.string())

export async function POST(request: Request) {
  const auth = await requireAuth(MANAGEMENT_ROLES)
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 })

  try {
    const formData = await request.formData()
    const files = formData.getAll('files').filter((entry): entry is File => entry instanceof File)
    if (files.length === 0 || files.some((file) => file.size === 0)) {
      return NextResponse.json({ error: 'Brak pliku' }, { status: 400 })
    }
    if (files.length > MAX_RECEIPT_PAGES) {
      return NextResponse.json(
        { error: `Za dużo stron — maksymalnie ${MAX_RECEIPT_PAGES} na jedną fakturę` },
        { status: 400 },
      )
    }
    if (files.some((file) => !isAllowedUploadMime(file.type))) {
      return NextResponse.json({ error: 'Nieobsługiwany typ pliku' }, { status: 400 })
    }

    const raw = formData.get('otherCategoryNames')
    const parsed = categoryNamesSchema.safeParse(typeof raw === 'string' ? JSON.parse(raw) : [])
    if (!parsed.success) {
      return NextResponse.json({ error: 'Nieprawidłowa lista kategorii' }, { status: 400 })
    }

    return NextResponse.json({ data: await scanReceipt(files, parsed.data) })
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'Nieprawidłowa lista kategorii' }, { status: 400 })
    }
    // TODO(EX-958) SENTRY-REQUIRED: receipt extraction failures must be captured once Sentry is
    // wired — they are silent AI/provider errors users can't self-report.
    logError('[extract-receipt] Scan failed:', err)
    const message = err instanceof Error ? err.message : 'Błąd odczytu paragonu'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
