import type { Payload } from 'payload'

/** Upload a single invoice file to the media collection. Returns the media ID. */
export async function uploadInvoiceFile(payload: Payload, file: File): Promise<number> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const media = await payload.create({
    collection: 'media',
    file: {
      data: buffer,
      mimetype: file.type,
      name: file.name,
      size: file.size,
    },
    data: {},
  })
  return media.id
}
