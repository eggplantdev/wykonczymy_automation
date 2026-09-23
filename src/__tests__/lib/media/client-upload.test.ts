import { afterEach, describe, expect, it, vi } from 'vitest'

import { createMediaRow } from '@/lib/media/client-upload'

const tick = () => new Promise((resolve) => setTimeout(resolve, 1))
const pdf = (name: string) => new File(['%PDF'], name, { type: 'application/pdf' })

describe('createMediaRow', () => {
  afterEach(() => vi.unstubAllGlobals())

  // On Neon, concurrent `POST /api/media` calls each return an id but only one row commits — the
  // bulk insert then trips `transactions_rels_media_id_fkey` on the ids that never existed.
  it('never has two row creates in flight at once', async () => {
    const rows = { inFlight: 0, maxInFlight: 0, nextId: 1 }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        rows.inFlight++
        rows.maxInFlight = Math.max(rows.maxInFlight, rows.inFlight)
        await tick()
        rows.inFlight--
        return new Response(JSON.stringify({ doc: { id: rows.nextId++ } }))
      }),
    )

    const ids = await Promise.all(
      ['a.pdf', 'b.pdf', 'c.pdf'].map((name) => createMediaRow(name, pdf(name), {})),
    )

    expect(ids.sort()).toEqual([1, 2, 3])
    expect(rows.maxInFlight).toBe(1)
  })

  it('keeps creating rows after one create fails', async () => {
    let call = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        ++call === 1
          ? new Response('{}', { status: 500 })
          : new Response(JSON.stringify({ doc: { id: 42 } })),
      ),
    )

    const results = await Promise.allSettled([
      createMediaRow('a.pdf', pdf('a.pdf'), {}),
      createMediaRow('b.pdf', pdf('b.pdf'), {}),
    ])

    expect(results.map((result) => result.status)).toEqual(['rejected', 'fulfilled'])
  })
})
