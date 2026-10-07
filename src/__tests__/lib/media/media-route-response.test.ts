import { describe, expect, it } from 'vitest'
import { mediaIdFrom } from '@/lib/media/media-route-response'

const photo = new File(['x'], 'paragon.jpg', { type: 'image/jpeg' })

describe('mediaIdFrom', () => {
  it('returns the row id', async () => {
    await expect(mediaIdFrom(Response.json({ id: 42 }), '/api/x', photo)).resolves.toBe(42)
  })

  it.each([400, 409, 413, 415])('words a %i as the file being refused', async (status) => {
    const response = Response.json({ error: 'x' }, { status })

    await expect(mediaIdFrom(response, '/api/x', photo)).rejects.toMatchObject({
      messageKey: 'uploadRejected',
      messageParams: { name: 'paragon.jpg' },
    })
  })

  it('words any other failure as a failed save', async () => {
    const response = Response.json({ error: 'x' }, { status: 500 })

    await expect(mediaIdFrom(response, '/api/x', photo)).rejects.toMatchObject({
      messageKey: 'uploadSaveFailed',
      messageParams: { name: 'paragon.jpg', status: 500 },
    })
  })

  it('refuses an ok response without an id', async () => {
    const response = new Response('<html>', { status: 200 })

    await expect(mediaIdFrom(response, '/api/x', photo)).rejects.toMatchObject({
      messageKey: 'uploadNoFileReturned',
    })
  })
})
