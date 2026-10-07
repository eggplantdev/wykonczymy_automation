import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { put } from '@vercel/blob'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { ROLES } from '@/lib/auth/roles'
import { CACHE_TAGS, EXPIRE_NOW } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import { deleteMediaRow, insertMediaRow } from '@/lib/db/media'
import { serverEnv } from '@/lib/env/server'
import { ROUTE_BODY_MAX_BYTES } from '@/lib/constants/route-body'
import { sniffMime } from '@/lib/media/sniff-mime'
import { perfStart } from '@/lib/perf'
import { logError } from '@/lib/utils/log-error'
import { uniqueFileName } from '@/lib/utils/unique-file-name'
import { MEDIA_KINDS } from '@/types/media'

/**
 * An API route rather than a server action because Next runs one client's actions one at a time, and a multi-photo send
 * needs its uploads in parallel.
 *
 * The blob key is the row's `filename` with no prefix and no random suffix — the layout the Blob
 * plugin writes, which is what lets `/api/media/file/<filename>` serve it and the collection's
 * afterDelete remove it.
 */

const kindSchema = z.enum(MEDIA_KINDS).optional()

export async function POST(request: Request) {
  const auth = await requireAuth(ROLES)
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file')
  const kind = kindSchema.safeParse(formData.get('kind') ?? undefined)
  if (!(file instanceof File) || file.size === 0 || !kind.success) {
    return NextResponse.json({ error: 'Nieprawidłowy plik' }, { status: 400 })
  }
  if (file.size > ROUTE_BODY_MAX_BYTES) {
    return NextResponse.json({ error: 'Plik jest za duży' }, { status: 413 })
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const mimeType = sniffMime(bytes)
  if (!mimeType) {
    return NextResponse.json({ error: 'To nie jest zdjęcie ani PDF' }, { status: 415 })
  }

  const elapsed = perfStart()
  const filename = uniqueFileName(file.name)
  // Row first: the UNIQUE filename index then refuses a colliding name before any bytes move —
  // `put` without a random suffix would silently overwrite another row's file.
  const db = await getDb(await getPayload({ config }))
  let id: number
  try {
    id = await insertMediaRow(db, {
      filename,
      mimeType,
      filesize: file.size,
      kind: kind.data ?? null,
      createdById: auth.user.id,
    })
  } catch (err) {
    // TODO(EX-449) SENTRY-REQUIRED: a failed media insert loses the worker's photo until they retry.
    logError('[media-upload] Media insert failed:', err)
    return NextResponse.json({ error: 'Nie udało się zapisać pliku' }, { status: 500 })
  }
  const insertMs = elapsed()

  try {
    await put(filename, bytes, {
      access: 'public',
      // @vercel/blob defaults this to true, which would store the bytes under a key that no
      // longer equals `filename` — every read through `/api/media/file/…` would then 404.
      addRandomSuffix: false,
      cacheControlMaxAge: 31536000,
      contentType: mimeType,
      token: serverEnv.BLOB_READ_WRITE_TOKEN,
    })
  } catch (err) {
    await deleteMediaRow(db, id).catch((delErr) =>
      logError('[media-upload] Byteless media row delete failed:', delErr, id),
    )
    // TODO(EX-449) SENTRY-REQUIRED: a failed Blob PUT loses the worker's photo until they retry.
    logError('[media-upload] Blob put failed:', err)
    return NextResponse.json({ error: 'Nie udało się zapisać pliku' }, { status: 500 })
  }
  const putMs = elapsed()

  revalidateTag(CACHE_TAGS.media, EXPIRE_NOW)
  console.log(`[PERF] mediaUpload ${file.size}B insert=${insertMs}ms put=${putMs}ms`)
  return NextResponse.json({ id })
}
