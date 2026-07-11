import type { Payload } from 'payload'

import { sanitizeFileName } from '@/lib/utils/sanitize-filename'
import { appendShortId, splitExtension } from '@/lib/utils/append-short-id'

function uniqueFileName(rawName: string): string {
  const { base, ext } = splitExtension(sanitizeFileName(rawName) || 'upload')
  return appendShortId(base, ext)
}

function validateFile(file: File): string {
  const name = file.name?.trim()
  if (!name) return 'Plik nie ma nazwy'
  if (!file.type) return 'Nierozpoznany typ pliku'
  if (file.size === 0) return 'Plik jest pusty'
  return ''
}

/** Upload a file to the media collection. Returns the media ID. */
export async function uploadFile(payload: Payload, file: File): Promise<number> {
  console.log('[UPLOAD] file debug:', {
    name: file.name,
    type: file.type,
    size: file.size,
    nameType: typeof file.name,
  })

  const error = validateFile(file)
  if (error) throw new Error(error)

  const buffer = Buffer.from(await file.arrayBuffer())
  const media = await payload.create({
    collection: 'media',
    file: {
      data: buffer,
      mimetype: file.type,
      name: uniqueFileName(file.name),
      size: file.size,
    },
    data: {},
  })
  return media.id
}
