import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { acquireTestWorkshop } from '@/__tests__/helpers/workshop'
import { SNAPSHOT_SCHEMA_VERSION, type SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'

// The szablon autosave either lives or dies IN THE DATABASE: the grid renders its own state
// regardless of whether anything reached `kosztorys_presets`. So every assertion reads the stored
// payload,
// nigdy wyniku akcji.

const authState = vi.hoisted(() => ({ userId: 0 }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => ({ revalidateCollections: vi.fn() }))

const { updateSectionFieldAction } = await import('@/lib/actions/kosztorys')
const { mirrorWorkshopPreset } = await import('@/lib/actions/mirror-workshop-preset')
const { flushWorkshopPresetAction } = await import('@/lib/actions/kosztorys-presets')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

const HELD_PRESET = 'mirror-fixture-held'
const OTHER_PRESET = 'mirror-fixture-other'

function emptyPayload(): SnapshotPayloadT {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    sections: [],
    items: [],
    stages: [],
    progress: [],
    settings: { wToolsCoeff: 0, ownToolsCoeff: 0, vatRate: 0 },
  }
}

describe.skipIf(!ENV_READY)('mirrorWorkshopPreset — autozapis warsztatu (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let workshop: Awaited<ReturnType<typeof acquireTestWorkshop>>
  let heldPresetId: number
  let otherPresetId: number
  let sectionId: number
  let plainInvestmentId: number
  let plainSectionId: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    const users = await payload.find({
      collection: 'users',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const firstUser = users.docs[0]
    if (!firstUser) throw new Error('no user in the DB to run the actions as')
    authState.userId = Number(firstUser.id)

    // Cleanup on the way in: the szablon library is shared, so a row left by a failed run would
    // produce „the throttle refused" for a reason that has nothing to do with the throttle.
    await db.execute(
      sql`DELETE FROM kosztorys_presets WHERE name IN (${HELD_PRESET}, ${OTHER_PRESET})`,
    )
    const { insertPreset } = await import('@/lib/db/presets')
    const held = await insertPreset(db, {
      name: HELD_PRESET,
      createdBy: authState.userId,
      payload: emptyPayload(),
    })
    const other = await insertPreset(db, {
      name: OTHER_PRESET,
      createdBy: authState.userId,
      payload: emptyPayload(),
    })
    if (held == null || other == null) throw new Error('fixture presets already exist — stale run?')
    heldPresetId = held
    otherPresetId = other

    workshop = await acquireTestWorkshop(payload)
    const { setWorkshopPreset } = await import('@/lib/db/workshop-investment')
    await setWorkshopPreset(db, workshop.id, heldPresetId)

    const section = await payload.create({
      collection: 'kosztorys-sections',
      data: { investment: workshop.id, name: 'Sekcja startowa', displayOrder: 0 },
      context: { skipRevalidation: true },
      overrideAccess: true,
    })
    sectionId = Number(section.id)

    plainInvestmentId = await createTestInvestment(payload, 'mirror-fixture-plain')
    const plainSection = await payload.create({
      collection: 'kosztorys-sections',
      data: { investment: plainInvestmentId, name: 'Sekcja zwykła', displayOrder: 0 },
      context: { skipRevalidation: true },
      overrideAccess: true,
    })
    plainSectionId = Number(plainSection.id)
  })

  afterAll(async () => {
    if (sectionId) {
      await payload.delete({
        collection: 'kosztorys-sections',
        id: sectionId,
        context: { skipRevalidation: true },
        overrideAccess: true,
      })
    }
    await workshop.release()
    if (plainInvestmentId) await deleteTestInvestment(payload, plainInvestmentId)
    await db.execute(
      sql`DELETE FROM kosztorys_presets WHERE name IN (${HELD_PRESET}, ${OTHER_PRESET})`,
    )
  })

  async function sectionNamesOf(presetId: number): Promise<string[]> {
    const { getPreset } = await import('@/lib/db/presets')
    const preset = await getPreset(db, presetId)
    return (preset?.payload.sections ?? []).map((section) => section.name)
  }

  async function mirroredAt(presetId: number): Promise<string | null> {
    const res = await db.execute(
      sql`SELECT mirrored_at FROM kosztorys_presets WHERE id = ${presetId}`,
    )
    const value = res.rows[0]?.mirrored_at
    return value == null ? null : String(value)
  }

  async function openTheThrottleWindow(presetId: number): Promise<void> {
    await db.execute(sql`UPDATE kosztorys_presets SET mirrored_at = NULL WHERE id = ${presetId}`)
  }

  it('przepisuje zmianę w warsztacie do szablonu, który warsztat trzyma', async () => {
    await openTheThrottleWindow(heldPresetId)

    const result = await updateSectionFieldAction(sectionId, { name: 'Sekcja po zmianie' })

    expect(result).toMatchObject({ success: true })
    expect(await sectionNamesOf(heldPresetId)).toContain('Sekcja po zmianie')
  })

  // Pasting fifty cells is fifty mutations; without the throttle that is fifty rewrites of the
  // whole jsonb.
  it('nie przepisuje drugi raz w oknie dławika', async () => {
    await openTheThrottleWindow(heldPresetId)
    await updateSectionFieldAction(sectionId, { name: 'Pierwsza w oknie' })
    const stampAfterFirst = await mirroredAt(heldPresetId)

    await updateSectionFieldAction(sectionId, { name: 'Druga w oknie' })

    expect(await mirroredAt(heldPresetId)).toBe(stampAfterFirst)
    expect(await sectionNamesOf(heldPresetId)).toContain('Pierwsza w oknie')
    expect(await sectionNamesOf(heldPresetId)).not.toContain('Druga w oknie')
  })

  // The throttle loses the LAST change by definition: no mutation follows it to carry it in.
  // That is the one hole the client-side tail-closer patches.
  it('dopchnięcie dowozi zmianę, którą dławik odrzucił', async () => {
    await openTheThrottleWindow(heldPresetId)
    await updateSectionFieldAction(sectionId, { name: 'Pierwsza w oknie' })
    await updateSectionFieldAction(sectionId, { name: 'Ostatnia i porzucona' })
    expect(await sectionNamesOf(heldPresetId)).not.toContain('Ostatnia i porzucona')

    await flushWorkshopPresetAction(heldPresetId)

    expect(await sectionNamesOf(heldPresetId)).toContain('Ostatnia i porzucona')
  })

  it('nie dotyka żadnego szablonu przy mutacji na zwykłej inwestycji', async () => {
    await openTheThrottleWindow(heldPresetId)
    const before = await sectionNamesOf(heldPresetId)

    await updateSectionFieldAction(plainSectionId, { name: 'Zmiana poza warsztatem' })

    expect(await sectionNamesOf(heldPresetId)).toEqual(before)
    expect(await mirroredAt(heldPresetId)).toBeNull()
  })

  // The pointer is read INSIDE the transaction, because between the start of the action and the
  // write someone may have switched the workbench — and then the new szablon's content would land
  // in the old one's row.
  it('nic nie pisze, gdy warsztat trzyma już inny szablon', async () => {
    await openTheThrottleWindow(otherPresetId)

    await mirrorWorkshopPreset(payload, {
      investmentId: workshop.id,
      templatePresetId: otherPresetId,
      force: true,
    })

    expect(await sectionNamesOf(otherPresetId)).toEqual([])
    expect(await mirroredAt(otherPresetId)).toBeNull()
  })
})
