import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { BlobNotFoundError, del, head } from '@vercel/blob'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { ROLES } from '@/lib/auth/roles'
import { CACHE_TAGS, EXPIRE_NOW } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import type { DbExecutorT } from '@/lib/db/get-db'
import { insertMediaRow, isMediaFilenameReferenced } from '@/lib/db/media'
import { UNIQUE_VIOLATION, hasPgCode } from '@/lib/db/pg-error'
import { serverEnv } from '@/lib/env/server'
import { blobPublicUrl, blobStoreIdOf } from '@/lib/media/blob-public-url'
import { SNIFF_BYTES, sniffMime } from '@/lib/media/sniff-mime'
import { perfStart } from '@/lib/perf'
import { logError } from '@/lib/utils/log-error'
import { MEDIA_KINDS } from '@/types/media'

/**
 * The second hop of a file too big for `/api/media-upload`: the browser has already PUT the bytes
 * to Blob under `filename`, and this turns that blob into a `media` row from its metadata and its
 * first KB — no download of the whole file, no thumbnail, no re-PUT.
 *
 * The filename comes from the client, so the route never deletes a blob it cannot prove is the
 * caller's fresh, unreferenced upload: production Blob holds tax-retained faktury and has no undelete.
 */

// Long enough for a slow PUT of a big PDF to reach this call; short enough that an old faktura's
// key can never pass as a fresh upload.
const FRESH_MS = 60 * 60 * 1000

const bodySchema = z.object({
  filename: z
    .string()
    .min(1)
    .refine((name) => !name.includes('/')),
  kind: z.enum(MEDIA_KINDS).optional(),
})

const failure = (error: string, status: number) => NextResponse.json({ error }, { status })

async function deleteIfUnreferenced(db: DbExecutorT, url: string, filename: string, token: string) {
  try {
    if (await isMediaFilenameReferenced(db, filename)) return
    await del(url, { token })
  } catch (err) {
    logError('[media-register] Refused blob delete failed:', err, filename)
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth(ROLES)
  if (!auth.success) return failure(auth.error, 401)

  const body = bodySchema.safeParse(await request.json().catch(() => undefined))
  if (!body.success) return failure('Nieprawidłowy plik', 400)
  const { filename, kind } = body.data

  const token = serverEnv.BLOB_READ_WRITE_TOKEN
  const storeId = blobStoreIdOf(token)
  if (!storeId) {
    logError('[media-register] BLOB_READ_WRITE_TOKEN names no store')
    return failure('Nie udało się zapisać pliku', 500)
  }
  const url = blobPublicUrl(storeId, filename)

  const elapsed = perfStart()
  let blob: Awaited<ReturnType<typeof head>>
  try {
    blob = await head(url, { token })
  } catch (err) {
    if (err instanceof BlobNotFoundError) return failure('Nie znaleziono przesłanego pliku', 400)
    logError('[media-register] Blob head failed:', err, filename)
    return failure('Nie udało się zapisać pliku', 500)
  }
  if (Date.now() - blob.uploadedAt.getTime() > FRESH_MS) {
    return failure('Nie znaleziono przesłanego pliku', 400)
  }
  const headMs = elapsed()

  const range = await fetch(url, { headers: { Range: `bytes=0-${SNIFF_BYTES - 1}` } }).catch(
    (err) => {
      logError('[media-register] Blob range read failed:', err, filename)
      return undefined
    },
  )
  if (!range?.ok) return failure('Nie udało się zapisać pliku', 500)
  const mimeType = sniffMime(new Uint8Array(await range.arrayBuffer()).subarray(0, SNIFF_BYTES))
  const rangeMs = elapsed()

  const db = await getDb(await getPayload({ config }))
  if (!mimeType) {
    await deleteIfUnreferenced(db, url, filename, token)
    return failure('To nie jest zdjęcie ani PDF', 415)
  }

  let id: number
  try {
    id = await insertMediaRow(db, {
      filename,
      mimeType,
      filesize: blob.size,
      kind: kind ?? null,
      createdById: auth.user.id,
    })
  } catch (err) {
    // A taken filename means the blob already belongs to a row — answered, never deleted.
    if (hasPgCode(err, [UNIQUE_VIOLATION])) return failure('Plik jest już zapisany', 409)
    // TODO(EX-449) SENTRY-REQUIRED: a failed media insert loses the upload until the user retries.
    logError('[media-register] Media insert failed:', err)
    await deleteIfUnreferenced(db, url, filename, token)
    return failure('Nie udało się zapisać pliku', 500)
  }
  const insertMs = elapsed()

  revalidateTag(CACHE_TAGS.media, EXPIRE_NOW)
  console.log(
    `[PERF] mediaRegister ${blob.size}B head=${headMs}ms range=${rangeMs}ms insert=${insertMs}ms`,
  )
  return NextResponse.json({ id })
}
