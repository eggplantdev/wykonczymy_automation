import type { Payload } from 'payload'

import { uniqueFileName } from '@/lib/utils/unique-file-name'
import { validateUploadFile } from '@/lib/utils/validate-upload-file'

/** Upload a file to the media collection. Returns the media ID. */
export async function uploadFile(payload: Payload, file: File): Promise<number> {
  const error = validateUploadFile(file)
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
