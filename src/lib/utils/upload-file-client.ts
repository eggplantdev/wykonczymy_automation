import { compressImage } from '@/lib/utils/compress-image'

type UploadResultT = { mediaId: number }

/** Compress (if image) and upload a file via the API route. Returns the media ID. */
export async function uploadFileClient(file: File): Promise<number> {
  const compressed = await compressImage(file)

  const formData = new FormData()
  formData.set('file', compressed)

  const res = await fetch('/api/upload-file', {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Upload nie powiódł się' }))
    throw new Error(body.error ?? `Upload failed (${res.status})`)
  }

  const data: UploadResultT = await res.json()
  return data.mediaId
}

/** Upload multiple files in parallel. Returns array of mediaIds (undefined for missing slots). */
export async function uploadFilesClient(
  files: Map<number, File>,
  count: number,
): Promise<(number | undefined)[]> {
  return Promise.all(
    Array.from({ length: count }, async (_, i) => {
      const file = files.get(i)
      if (!file) return undefined
      return uploadFileClient(file)
    }),
  )
}
