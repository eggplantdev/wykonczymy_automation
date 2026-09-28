import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { insertSnapshot, type SnapshotKindT } from '@/lib/db/snapshots'
import type { KosztorysSnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import { serializeTree } from '@/lib/kosztorys/serialize-tree'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'
import { buildKosztorysTree } from '@/lib/queries/kosztorys'
import { getPreviewHistoryByToken } from '@/lib/queries/preview-kosztorys-history'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

vi.mock('server-only', () => ({}))

// The share token is the investor's whole credential, and `?wersja=` is an id they can edit by hand —
// so every scope below is asserted against real rows, where a WHERE that silently matches too much
// would show.

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('getPreviewHistoryByToken (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let otherInvestmentId: number
  let current: KosztorysTreeT
  const ids: Record<string, number> = {}
  const token = `test-token-ex881-history-${process.pid}-${Date.now()}`

  const withPlannedQty = (plannedQty: number): KosztorysSnapshotPayloadT => {
    const snapshot = serializeTree(current)
    return { ...snapshot, items: snapshot.items.map((item) => ({ ...item, plannedQty })) }
  }

  const insert = (
    id: number,
    kind: SnapshotKindT,
    takenAt: string,
    snapshot: KosztorysSnapshotPayloadT,
    label: string | null = null,
  ) =>
    insertSnapshot(db, {
      investmentId: id,
      kind,
      label,
      takenBy: null,
      payload: snapshot,
      takenAt: new Date(takenAt),
    })

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    investmentId = await createTestInvestment(payload, 'EX-881 history spec')
    otherInvestmentId = await createTestInvestment(payload, 'EX-881 history spec — other')
    await payload.create({
      collection: 'kosztorys-shares',
      data: { investment: investmentId, token },
    })
    await createKosztorysTree(payload, investmentId, {
      sections: [
        { name: 'Łazienka', items: [{ description: 'Płytki', plannedQty: 14, clientPrice: 100 }] },
      ],
    })
    current = await buildKosztorysTree(investmentId)

    // Three autos on one pre-daily day: only the newest may be listed.
    ids.autoEarly = await insert(investmentId, 'auto', '2026-01-10T08:00:00Z', withPlannedQty(8))
    ids.autoMid = await insert(investmentId, 'auto', '2026-01-10T12:00:00Z', withPlannedQty(9))
    ids.autoLate = await insert(investmentId, 'auto', '2026-01-10T16:00:00Z', withPlannedQty(10))
    ids.manual = await insert(investmentId, 'manual', '2026-01-11T10:00:00Z', withPlannedQty(99))
    ids.daily1 = await insert(investmentId, 'daily', '2026-01-11T22:59:59.999Z', withPlannedQty(11))
    ids.daily2 = await insert(investmentId, 'daily', '2026-01-12T22:59:59.999Z', withPlannedQty(12))

    // A row from before the rabat was captured.
    const { globalDiscount: _dropped, ...legacy } = withPlannedQty(12)
    ids.legacy = await insert(
      investmentId,
      'named',
      '2026-01-13T09:00:00Z',
      legacy as KosztorysSnapshotPayloadT,
      'Oferta',
    )

    ids.foreign = await insert(
      otherInvestmentId,
      'daily',
      '2026-01-11T22:59:59.999Z',
      withPlannedQty(1),
    )
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId)
    if (otherInvestmentId) await deleteTestInvestment(payload, otherInvestmentId)
  })

  it('lists one version per day plus the named one, newest first, and never a manual row', async () => {
    const history = await getPreviewHistoryByToken(token, current)
    const listed = history!.entries.map(({ id }) => id)

    expect(listed).toEqual([ids.legacy, ids.daily2, ids.daily1, ids.autoLate])
    expect(listed).not.toContain(ids.manual)
    const unnamedDays = history!.entries
      .filter(({ kind }) => kind !== 'named')
      .map(({ day }) => day)
    expect(new Set(unnamedDays).size).toBe(unnamedDays.length)
  })

  it('opens a listed version with its diff against the present', async () => {
    const { version } = (await getPreviewHistoryByToken(token, current, ids.daily2))!
    expect(version).toMatchObject({ id: ids.daily2, kind: 'daily', day: '2026-01-12' })
    expect([...version!.diff.changed.values()][0].fields).toContainEqual({
      field: 'plannedQty',
      before: 12,
      after: 14,
    })
  })

  it('reads a payload stored without a rabat as an unknown rabat, not 0 zł', async () => {
    const { version } = (await getPreviewHistoryByToken(token, current, ids.legacy))!
    expect(version!.discount).toEqual({ known: false })
    expect(version!.diff.discount).toEqual({ state: 'unknown' })
  })

  it.each([
    ['another investment’s version', () => ids.foreign],
    ['a manual row', () => ids.manual],
    ['an id that does not exist', () => 2_147_483_000],
  ])('renders the present for %s', async (_, versionId) => {
    const history = await getPreviewHistoryByToken(token, current, versionId())
    expect(history).not.toBeNull()
    expect(history!.version).toBeNull()
  })

  it('returns null for an unknown token', async () => {
    expect(await getPreviewHistoryByToken('no-such-token-ex881', current, ids.daily1)).toBeNull()
  })

  it('returns null while the investment is in the trash', async () => {
    await payload.update({
      collection: 'investments',
      id: investmentId,
      data: { trashedAt: new Date().toISOString() },
      overrideAccess: true,
    })
    try {
      expect(await getPreviewHistoryByToken(token, current, ids.daily1)).toBeNull()
    } finally {
      await payload.update({
        collection: 'investments',
        id: investmentId,
        data: { trashedAt: null },
        overrideAccess: true,
      })
    }
  })
})
