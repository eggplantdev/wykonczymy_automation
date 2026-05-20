import { put, head } from '@vercel/blob'
import type { IWorkbookDataT } from './types'

const BLOB_PATH_PREFIX = 'kosztorys'

function blobPath(investmentId: number | string): string {
  return `${BLOB_PATH_PREFIX}/${investmentId}.json`
}

/**
 * Returns the workbook JSON for a given investment, or null if no workbook
 * has been seeded yet.
 *
 * Note: blobs are stored with access: 'public' for spike simplicity. The URL
 * is predictable from the investmentId — acceptable for testing, must move
 * to private + signed URLs before this leaves spike status.
 */
function isBlobNotFound(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message.toLowerCase()
  // @vercel/blob throws "The requested blob does not exist" (with optional store id prefix)
  return msg.includes('does not exist') || msg.includes('not found')
}

export async function getWorkbook(investmentId: number | string): Promise<IWorkbookDataT | null> {
  const pathname = blobPath(investmentId)
  try {
    const meta = await head(pathname)
    const res = await fetch(meta.url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`workbook fetch failed: ${res.status}`)
    return (await res.json()) as IWorkbookDataT
  } catch (err) {
    if (isBlobNotFound(err)) return null
    throw err
  }
}

export async function putWorkbook(
  investmentId: number | string,
  workbook: IWorkbookDataT,
): Promise<{ url: string }> {
  const pathname = blobPath(investmentId)
  const result = await put(pathname, JSON.stringify(workbook), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  })
  return { url: result.url }
}

export async function workbookExists(investmentId: number | string): Promise<boolean> {
  const pathname = blobPath(investmentId)
  try {
    await head(pathname)
    return true
  } catch (err) {
    if (isBlobNotFound(err)) return false
    throw err
  }
}
