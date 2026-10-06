import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { listWorkerReports, readWorkerReport } from '@/lib/db/worker-reports'
import { deleteUnreferencedMedia } from '@/lib/media/delete-unreferenced-media'
import { formatFormRef } from '@/lib/kosztorys/worker-report/check-digit'
import type { ScanPageT } from '@/lib/kosztorys/worker-report/types'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

vi.mock('server-only', () => ({}))
const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({
    success: true,
    user: { id: authState.userId, email: 'k@t.com', name: 'Kierownik', role: 'MANAGER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))
const scheduled = vi.hoisted(() => [] as (() => unknown)[])
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: (task: () => unknown) => void scheduled.push(task) }
})

const { createScannedReportAction } = await import('@/lib/actions/worker-report-scan')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const FILENAME_PREFIX = 'ex-949-scan-'

describe.skipIf(!ENV_READY)('createScannedReportAction (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let workerId: number
  let managerId: number
  let itemId: number
  let itemRef: number

  const ctx = { context: { skipRevalidation: true } }

  const purgeMedia = () =>
    db.execute(sql`DELETE FROM media WHERE filename LIKE ${`${FILENAME_PREFIX}%`}`)

  // Raw INSERT: an upload through Payload would push bytes at the Blob store for a fixture nothing opens.
  async function insertMedia(name: string, uploadedBy = managerId): Promise<number> {
    const { rows } = await db.execute(sql`
      INSERT INTO media (filename, mime_type, filesize, created_by_id)
      VALUES (${`${FILENAME_PREFIX}${name}.jpg`}, 'image/jpeg', 1024, ${uploadedBy})
      RETURNING id
    `)
    return Number(rows[0].id)
  }

  const mediaExists = async (id: number) =>
    (await db.execute(sql`SELECT 1 FROM media WHERE id = ${id}`)).rows.length > 0

  const pageOf = (qty: number, isUncertain = false): ScanPageT => ({
    rows: [{ ref: formatFormRef(itemRef), qty, isUncertain }],
    extras: [{ description: 'Listwy', unit: 'kurs', qty: 3, isUncertain: false }],
  })

  const scan = async (name: string, page = pageOf(4)) =>
    createScannedReportAction({
      investmentId,
      workerId,
      pages: [page],
      mediaIds: [await insertMedia(name)],
    })

  const setUserActive = (id: number, active: boolean) =>
    db.execute(sql`UPDATE users SET active = ${active} WHERE id = ${id}`)

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await purgeMedia()
    await purgeFixtureUsers(db)

    investmentId = await createTestInvestment(payload, 'EX-949 scan report spec')
    const user = (name: string, email: string, role: 'EMPLOYEE' | 'MANAGER') =>
      payload.create({
        collection: 'users',
        data: { name, role, email, password: 'test-password-123' },
        ...ctx,
      })
    workerId = Number((await user('Jan Skanowany', 'scan-worker@test.local', 'EMPLOYEE')).id)
    managerId = Number((await user('Kierownik Skanu', 'scan-manager@test.local', 'MANAGER')).id)
    authState.userId = managerId
    ;({
      itemIds: [itemId],
    } = await createKosztorysTree(payload, investmentId, {
      sections: [
        { name: 'Salon', items: [{ description: 'Malowanie ścian', unit: 'm2', plannedQty: 40 }] },
      ],
      stages: [{ worker: workerId, plane: 'w_tools' }],
    }))
    itemRef = Number(
      (await db.execute(sql`SELECT ref FROM kosztorys_items WHERE id = ${itemId}`)).rows[0].ref,
    )
  })

  beforeEach(() => {
    scheduled.length = 0
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId).catch(() => {})
    await purgeMedia()
    await purgeFixtureUsers(db)
  })

  it('files a pending scan by the kierownik, with its flags and its photos', async () => {
    const first = await insertMedia('page-1')
    const second = await insertMedia('page-2')
    const result = await createScannedReportAction({
      investmentId,
      workerId,
      pages: [pageOf(4, true), { rows: [{ ref: '1-1', qty: 2, isUncertain: false }], extras: [] }],
      mediaIds: [first, second],
    })
    if (!result.success) throw new Error(result.error)

    const stored = await readWorkerReport(db, investmentId, result.data.reportId)
    expect(stored?.report).toMatchObject({
      status: 'pending',
      source: 'scan',
      createdByName: 'Kierownik Skanu',
    })
    expect(
      stored?.lines.map(({ kind, itemId: lineItem, unit, isUncertain, scannedRef }) => ({
        kind,
        itemId: lineItem,
        unit,
        isUncertain,
        scannedRef,
      })),
    ).toEqual([
      { kind: 'rozpiska', itemId, unit: 'm2', isUncertain: true, scannedRef: null },
      { kind: 'extra', itemId: null, unit: '', isUncertain: false, scannedRef: null },
      { kind: 'rozpiska', itemId: null, unit: '', isUncertain: false, scannedRef: '1-1' },
    ])
    expect(stored?.media.map((photo) => photo.id)).toEqual([first, second])
    // The extra's translation rides after() like a link send.
    expect(scheduled).toHaveLength(1)
  })

  it('stays off the worker’s link history, and on the editor’s list', async () => {
    const result = await scan('history')
    if (!result.success) throw new Error(result.error)
    const linkIds = (await listWorkerReports(db, investmentId, workerId, { linkOnly: true })).map(
      (report) => report.id,
    )
    const editorIds = (await listWorkerReports(db, investmentId, workerId)).map(
      (report) => report.id,
    )
    expect(linkIds).not.toContain(result.data.reportId)
    expect(editorIds).toContain(result.data.reportId)
  })

  it('stores nothing when a photo is not the kierownik’s own upload', async () => {
    const before = (await listWorkerReports(db, investmentId, workerId)).length
    const result = await createScannedReportAction({
      investmentId,
      workerId,
      pages: [pageOf(1)],
      mediaIds: [await insertMedia('foreign', workerId)],
    })
    expect(result.success).toBe(false)
    expect(await listWorkerReports(db, investmentId, workerId)).toHaveLength(before)
  })

  it('refuses a paper with no ilość read', async () => {
    const result = await scan('empty', {
      rows: [{ ref: '1-1', qty: null, isUncertain: true }],
      extras: [],
    })
    expect(result).toMatchObject({ success: false, error: expect.stringMatching(/żadnej/) })
  })

  it('refuses a szablon', async () => {
    await db.execute(sql`UPDATE investments SET status = 'szablon' WHERE id = ${investmentId}`)
    try {
      expect(await scan('template')).toMatchObject({ success: false })
    } finally {
      await db.execute(sql`UPDATE investments SET status = 'active' WHERE id = ${investmentId}`)
    }
  })

  it('refuses an inactive worker, in the kierownik’s voice', async () => {
    await setUserActive(workerId, false)
    try {
      expect(await scan('inactive')).toMatchObject({
        success: false,
        error: expect.stringMatching(/Konto pracownika/),
      })
    } finally {
      await setUserActive(workerId, true)
    }
  })

  it('refuses a worker whose etapy are blocked', async () => {
    await db.execute(
      sql`UPDATE kosztorys_stages SET plane = NULL WHERE investment_id = ${investmentId}`,
    )
    try {
      expect(await scan('blocked')).toMatchObject({ success: false })
    } finally {
      await db.execute(
        sql`UPDATE kosztorys_stages SET plane = 'w_tools' WHERE investment_id = ${investmentId}`,
      )
    }
  })

  describe('a photo a zgłoszenie holds', () => {
    it('is left by the reclaim', async () => {
      const photo = await insertMedia('held')
      const result = await createScannedReportAction({
        investmentId,
        workerId,
        pages: [pageOf(1)],
        mediaIds: [photo],
      })
      expect(result.success).toBe(true)

      const deleteSpy = vi.spyOn(payload, 'delete')
      await deleteUnreferencedMedia(payload, [photo])
      expect(deleteSpy).not.toHaveBeenCalled()
      deleteSpy.mockRestore()
      expect(await mediaExists(photo)).toBe(true)
    })

    it('is refused by the delete guard', async () => {
      const photo = await insertMedia('guarded')
      const result = await createScannedReportAction({
        investmentId,
        workerId,
        pages: [pageOf(1)],
        mediaIds: [photo],
      })
      expect(result.success).toBe(true)

      await expect(
        payload.delete({ collection: 'media', id: photo, overrideAccess: true }),
      ).rejects.toThrow(/zgłoszenia prac: 1/)
      expect(await mediaExists(photo)).toBe(true)
    })
  })
})
