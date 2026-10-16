const FETCH_TIMEOUT_MS = 30_000

export function blobStoreIdOf(token: string): string | undefined {
  return /^vercel_blob_rw_([A-Za-z0-9]+)_/.exec(token)?.[1]
}

// Filenames predate `sanitizeFileName`, so they may hold characters that would build a wrong URL.
export function blobPublicUrl(storeId: string, filename: string): string {
  return `https://${storeId}.public.blob.vercel-storage.com/${encodeURIComponent(filename)}`
}

export async function fetchMediaBytes(
  storeId: string,
  media: { filename: string; mimeType: string },
): Promise<{ bytes: Uint8Array; mediaType: string; filename: string }> {
  const response = await fetch(blobPublicUrl(storeId, media.filename), {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`Blob ${response.status} for ${media.filename}`)
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    mediaType: media.mimeType,
    filename: media.filename,
  }
}
