import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import type { CollectionBeforeDeleteHook, Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { preventReferencedMediaDelete } from '@/hooks/media/prevent-referenced-delete'

// `assets` is investments' first relationship field, so this asserts the join table the migration
// created actually matches what Payload writes into it — a shape a mocked `payload.update` cannot
// see. Asserted on investments_rels, not on the action's result: a success value sits on top of
// whatever the write really did.

vi.mock('server-only', () => ({}))
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: () => {} }
})
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: 1, role: 'ADMIN', name: 'T', email: 't@t.pl' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => ({ revalidateCollections: vi.fn() }))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const NAME = 'EX-802 investment assets'
const FILENAMES = ['ex-802-a.jpg', 'ex-802-b.jpg']
const FILENAME_PREFIX = 'ex-802-%'

describe.skipIf(!ENV_READY)('investment asset actions (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let mediaIds: number[]
  let actions: typeof import('@/lib/actions/investment-assets')

  const purge = async () => {
    await db.execute(sql`DELETE FROM investments WHERE name = ${NAME}`)
    await db.execute(sql`DELETE FROM media WHERE filename LIKE ${FILENAME_PREFIX}`)
  }

  const attachedIds = async () => {
    const { rows } = await db.execute(sql`
      SELECT media_id FROM investments_rels
      WHERE parent_id = ${investmentId} AND path = 'assets'
      ORDER BY "order"
    `)
    return rows.map((row) => Number(row.media_id))
  }

  const mediaExists = async (id: number) => {
    const { rows } = await db.execute(sql`SELECT id FROM media WHERE id = ${id}`)
    return rows.length > 0
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    actions = await import('@/lib/actions/investment-assets')
  })

  // The media rows are rebuilt per test, not once: detaching a file deletes it for real here, so a
  // shared fixture would leave the later tests attaching ids that no longer exist.
  beforeEach(async () => {
    await purge()

    // Raw INSERT, not payload.create: an upload through Payload would push bytes at the Blob store
    // for a fixture nothing ever opens.
    mediaIds = []
    for (const filename of FILENAMES) {
      const { rows } = await db.execute(sql`
        INSERT INTO media (filename, mime_type, filesize, kind)
        VALUES (${filename}, 'image/jpeg', 1024, 'zdjecie')
        RETURNING id
      `)
      mediaIds.push(Number(rows[0].id))
    }

    const investment = await payload.create({
      collection: 'investments',
      data: { name: NAME, status: 'active', settlementMode: 'NET', assets: [] },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    investmentId = Number(investment.id)
  })

  afterAll(purge)

  it('persists a batch of ids in the order they were attached', async () => {
    const result = await actions.addInvestmentAssetsAction(investmentId, mediaIds)

    expect(result.success).toBe(true)
    expect(await attachedIds()).toEqual(mediaIds)
  })

  it('leaves the remaining files in order when one is removed', async () => {
    await actions.addInvestmentAssetsAction(investmentId, mediaIds)

    const result = await actions.removeInvestmentAssetAction(investmentId, mediaIds[0])

    expect(result.success).toBe(true)
    expect(await attachedIds()).toEqual([mediaIds[1]])
    // The detached file is now referenced by nothing, so it is reclaimed rather than left in the
    // library — the whole reason the action awaits `deleteUnreferencedMedia`.
    expect(await mediaExists(mediaIds[0])).toBe(false)
    expect(await mediaExists(mediaIds[1])).toBe(true)
  })

  it('refuses to delete a media row an investment points at', async () => {
    await actions.addInvestmentAssetsAction(investmentId, [mediaIds[0]])

    // The probes run on the delete's own `req`, so the user is load-bearing: `investments` is
    // read-gated to management and an anonymous probe counts zero references — i.e. it would let
    // the file go.
    const run = () =>
      preventReferencedMediaDelete({
        id: mediaIds[0],
        req: { payload, user: { id: 1, role: 'ADMIN' } },
      } as unknown as Parameters<CollectionBeforeDeleteHook>[0])

    await expect(run()).rejects.toThrow('inwestycje: 1')
  })
})
