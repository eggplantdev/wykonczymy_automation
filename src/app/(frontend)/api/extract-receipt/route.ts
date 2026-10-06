import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { scanReceipt } from '@/lib/ai/scan-receipt'
import { MAX_RECEIPT_PAGES } from '@/lib/constants/receipt-scan'
import { logError } from '@/lib/utils/log-error'

/**
 * Accepts FormData with N 'files' (the pages of ONE invoice, in order) and a JSON
 * 'otherCategoryNames' array.
 *
 * An API route, not a server action: a multi-page scan blows past the server-action body cap,
 * which surfaces as an uncatchable 413 rather than an error the form can report. The scan itself
 * still persists NOTHING — the files are uploaded once, at submit.
 */

// Must cover the worst-case scan budget in openrouter.ts (primary + fallback attempt), or the
// platform kills the invocation before the AbortController can report a clean timeout.
export const maxDuration = 300

// Mirrors `Media.upload.mimeTypes`. The sibling upload route gets this check for free from Payload;
// this one never touches the collection, so the bytes would otherwise reach the model on nothing
// but a client-declared type.
const ACCEPTED_TYPE = /^(image\/|application\/pdf$)/

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
    if (files.some((file) => !ACCEPTED_TYPE.test(file.type))) {
      return NextResponse.json({ error: 'Nieobsługiwany typ pliku' }, { status: 400 })
    }

    // A malformed list is a client bug, not a scan failure — 400 keeps it out of the 500 branch
    // (and out of the Sentry capture that branch is owed).
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
    // TODO(EX-449) SENTRY-REQUIRED: receipt extraction failures must be captured once Sentry is
    // wired — they are silent AI/provider errors users can't self-report.
    logError('[extract-receipt] Scan failed:', err)
    const message = err instanceof Error ? err.message : 'Błąd odczytu paragonu'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
