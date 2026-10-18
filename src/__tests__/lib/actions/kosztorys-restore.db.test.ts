import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { firstUserId } from '@/__tests__/helpers/user'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'

vi.mock('@/lib/auth/get-current-user-jwt', () => import('@/__tests__/stubs/get-current-user-jwt'))

const { restoreSnapshotAction, saveSnapshotAction } =
  await import('@/lib/actions/kosztorys-snapshots')

describe.skipIf(!ENV_READY)('restoreSnapshotAction — persisted state (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    authState.userId = await firstUserId(payload)
    investmentId = await createTestInvestment(payload, 'restore-snapshot-test')
  })

  afterAll(async () => {
    if (investmentId) {
      await deleteTestInvestment(payload, investmentId)
    }
  })

  const ctx = { context: { skipRevalidation: true } }

  async function sectionNames(): Promise<string[]> {
    const res = await db.execute(sql`
      SELECT name FROM kosztorys_sections WHERE investment_id = ${investmentId} ORDER BY display_order
    `)
    return res.rows.map((r) => String(r.name))
  }

  async function autoCount(): Promise<number> {
    const res = await db.execute(sql`
      SELECT COUNT(*) AS n FROM kosztorys_snapshots WHERE investment_id = ${investmentId} AND kind = 'auto'
    `)
    return Number(res.rows[0].n)
  }

  it('reverts a mutated tree and creates exactly one forced auto snapshot', async () => {
    const {
      sectionIds: [sectionId],
    } = await createKosztorysTree(payload, investmentId, {
      sections: [{ name: 'Original', items: [{}] }],
    })

    const saved = await saveSnapshotAction(investmentId, 'przed zmianą')
    expect(saved.success).toBe(true)
    const snapRow = await db.execute(sql`
      SELECT id FROM kosztorys_snapshots
      WHERE investment_id = ${investmentId} AND kind = 'named' ORDER BY id DESC LIMIT 1
    `)
    const snapshotId = Number(snapRow.rows[0].id)

    await payload.update({
      collection: 'kosztorys-sections',
      id: sectionId,
      data: { name: 'Zmienione' },
      ...ctx,
    })
    await createKosztorysTree(payload, investmentId, {
      sections: [{ name: 'Nowa', displayOrder: 1 }],
    })
    expect(await sectionNames()).toEqual(['Zmienione', 'Nowa'])

    const autoBefore = await autoCount()
    const res = await restoreSnapshotAction(snapshotId, investmentId)
    expect(res.success).toBe(true)

    expect(await sectionNames()).toEqual(['Original'])
    const items = await db.execute(sql`
      SELECT COUNT(*) AS n FROM kosztorys_items WHERE investment_id = ${investmentId}
    `)
    expect(Number(items.rows[0].n)).toBe(1)
    expect(await autoCount()).toBe(autoBefore + 1)
  })

  it('refuses to restore a snapshot belonging to another investment and writes nothing', async () => {
    expect((await saveSnapshotAction(investmentId, 'wersja A')).success).toBe(true)
    const snapRow = await db.execute(sql`
      SELECT id FROM kosztorys_snapshots
      WHERE investment_id = ${investmentId} AND kind = 'named' ORDER BY id DESC LIMIT 1
    `)
    const snapshotIdA = Number(snapRow.rows[0].id)

    const investmentIdB = await createTestInvestment(payload, 'restore-scope-other')
    try {
      const namesABefore = await sectionNames()
      const autoABefore = await autoCount()

      const res = await restoreSnapshotAction(snapshotIdA, investmentIdB)
      expect(res.success).toBe(false)

      expect(await sectionNames()).toEqual(namesABefore)
      expect(await autoCount()).toBe(autoABefore)
    } finally {
      await deleteTestInvestment(payload, investmentIdB)
    }
  })

  it('is gated — a non-MANAGEMENT role gets Brak uprawnień and writes nothing', async () => {
    const namesBefore = await sectionNames()
    const autoBefore = await autoCount()
    authState.role = 'EMPLOYEE'
    const res = await restoreSnapshotAction(1, investmentId).finally(() => {
      authState.role = 'OWNER'
    })

    expect(res.success).toBe(false)
    expect(res.success === false && res.error).toBe('Brak uprawnień')
    expect(await sectionNames()).toEqual(namesBefore)
    expect(await autoCount()).toBe(autoBefore)
  })
})
