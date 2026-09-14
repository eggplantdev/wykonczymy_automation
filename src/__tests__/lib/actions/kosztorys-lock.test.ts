import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment } from '@/__tests__/helpers/investment'

// The kosztorys plane's gate is the action wrapper, not a hook — a dozen places write raw SQL that
// no collection hook or Payload `access` rule ever sees. So the assertion has to be the SERVER'S
// refusal against the real DB, action by action: a UI-visibility test would prove nothing about the
// path that matters. The role is OWNER throughout, deliberately — the lock narrows on the
// investment's STATUS, not on who is asking, and the highest management role refusing is the point.
//
// Same mock surface as the sibling action specs.
const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => ({ revalidateCollections: vi.fn() }))

const {
  addItemAction,
  addSectionAction,
  addStageAction,
  applyPercentDiscountToAllItemsAction,
  cleanItemDescriptionsAction,
  clearKosztorysAction,
  insertItemAction,
  insertSectionAction,
  removeItemAction,
  removeSectionAction,
  removeStageAction,
  renumberKosztorysOrderAction,
  setStageProgressAction,
  swapItemOrderAction,
  swapSectionOrderAction,
  updateInvestmentCoeffsAction,
  updateInvestmentGlobalDiscountAction,
  updateInvestmentMaterialsNetRateAction,
  updateInvestmentSettlementModeAction,
  updateInvestmentVatAction,
  updateItemFieldAction,
  updateSectionFieldAction,
  updateStageAction,
} = await import('@/lib/actions/kosztorys')
const { listSnapshotsAction, saveSnapshotAction, snapshotAction } =
  await import('@/lib/actions/kosztorys-snapshots')
const { savePresetAction } = await import('@/lib/actions/kosztorys-presets')
const { compareWithSheet } = await import('@/lib/actions/kosztorys-import')
const { insertCatalogueItemsAction } = await import('@/lib/actions/work-catalogue')
const { INVESTMENT_LOCKED_MESSAGE } = await import('@/lib/constants/investment-lock')

// Gated like the sibling specs: skips with no DB env, FAILS if env is set but the DB is unreachable.
const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const FIXTURE_PREFIX = 'investment-lock-test-'

describe.skipIf(!ENV_READY)('a completed investment refuses every kosztorys write (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let sectionId: number
  let itemId: number
  let stageId: number

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
    if (!firstUser) throw new Error('no user in the DB to attribute the action to')
    authState.userId = Number(firstUser.id)

    // A crashed run leaves its investments behind, and financial-golden-master-db.test.ts enumerates
    // this same DB with `limit: 0` — a leaked fixture would show up there as unexplained drift.
    await db.execute(sql`DELETE FROM investments WHERE name LIKE ${`${FIXTURE_PREFIX}%`}`)

    // Built while still „Aktywna", then closed: the fixture has to carry a real row of each kind, or
    // a refusal would be indistinguishable from „row not found".
    investmentId = await createTestInvestment(payload, `${FIXTURE_PREFIX}${Date.now()}`)

    const section = await addSectionAction(investmentId)
    if (!section.success) throw new Error('fixture: addSectionAction failed')
    sectionId = section.data.section.id
    itemId = section.data.item.id

    const stage = await addStageAction(investmentId, 'w_tools')
    if (!stage.success) throw new Error('fixture: addStageAction failed')
    stageId = stage.data.id

    await payload.update({
      collection: 'investments',
      id: investmentId,
      data: { status: 'completed' },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM investments WHERE name LIKE ${`${FIXTURE_PREFIX}%`}`)
  })

  it.each([
    ['updateItemFieldAction', () => updateItemFieldAction(itemId, { description: 'zmiana' })],
    ['updateSectionFieldAction', () => updateSectionFieldAction(sectionId, { name: 'zmiana' })],
    [
      'updateInvestmentCoeffsAction',
      () => updateInvestmentCoeffsAction(investmentId, { wToolsCoeff: 2 }),
    ],
    ['updateInvestmentVatAction', () => updateInvestmentVatAction(investmentId, 0.23)],
    [
      'updateInvestmentSettlementModeAction',
      () => updateInvestmentSettlementModeAction(investmentId, 'GROSS'),
    ],
    [
      'updateInvestmentMaterialsNetRateAction',
      () => updateInvestmentMaterialsNetRateAction(investmentId, 0.5),
    ],
    [
      'updateInvestmentGlobalDiscountAction',
      () =>
        updateInvestmentGlobalDiscountAction(investmentId, {
          globalDiscountType: 'amount',
          globalDiscountValue: 100,
        }),
    ],
    [
      'applyPercentDiscountToAllItemsAction',
      () => applyPercentDiscountToAllItemsAction(investmentId, 10),
    ],
    ['cleanItemDescriptionsAction', () => cleanItemDescriptionsAction(investmentId)],
    ['clearKosztorysAction', () => clearKosztorysAction(investmentId)],
    ['addSectionAction', () => addSectionAction(investmentId)],
    ['removeSectionAction', () => removeSectionAction(sectionId)],
    ['insertSectionAction', () => insertSectionAction(sectionId, 'above')],
    ['swapSectionOrderAction', () => swapSectionOrderAction(sectionId, 'up')],
    ['addItemAction', () => addItemAction(sectionId)],
    ['insertItemAction', () => insertItemAction(itemId, 'above')],
    ['removeItemAction', () => removeItemAction(itemId)],
    ['swapItemOrderAction', () => swapItemOrderAction(itemId, 'up')],
    ['renumberKosztorysOrderAction', () => renumberKosztorysOrderAction(investmentId, [itemId])],
    ['addStageAction', () => addStageAction(investmentId, 'w_tools')],
    ['updateStageAction', () => updateStageAction(stageId, { label: 'zmiana' })],
    ['removeStageAction', () => removeStageAction(stageId)],
    ['setStageProgressAction', () => setStageProgressAction(itemId, stageId, 5)],
    ['snapshotAction', () => snapshotAction(investmentId)],
    ['saveSnapshotAction', () => saveSnapshotAction(investmentId, 'v1')],
    ['insertCatalogueItemsAction', () => insertCatalogueItemsAction(sectionId, [1])],
    // Reads like a comparison and writes like an import: it refreshes „Pomiar z natury" from the
    // arkusz, which is an UPDATE on the pozycje.
    ['compareWithSheet', () => compareWithSheet(investmentId)],
  ])('%s refuses', async (_name, call) => {
    expect(await call()).toEqual({ success: false, error: INVESTMENT_LOCKED_MESSAGE })
  })

  // The refusals above return before the handler, so the persisted rows are the proof no write leaked
  // through one of them.
  it('leaves the rows untouched after every refusal', async () => {
    const item = await payload.findByID({
      collection: 'kosztorys-items',
      id: itemId,
      depth: 0,
      overrideAccess: true,
    })
    expect(item.description).not.toBe('zmiana')
    const sections = await payload.find({
      collection: 'kosztorys-sections',
      where: { investment: { equals: investmentId } },
      depth: 0,
      overrideAccess: true,
    })
    expect(sections.totalDocs).toBe(1)
  })

  // The other half of the boundary: the lock stops writes, not reads — and a preset is a GLOBAL
  // template, so a finished kosztorys stays a legitimate source for one.
  it('still lists versions', async () => {
    expect((await listSnapshotsAction(investmentId)).success).toBe(true)
  })

  it('still saves a preset from the locked kosztorys', async () => {
    const name = `${FIXTURE_PREFIX}preset-${Date.now()}`
    expect((await savePresetAction(investmentId, name, 'new')).success).toBe(true)
    await db.execute(sql`DELETE FROM kosztorys_presets WHERE name = ${name}`)
  })
})

describe.skipIf(!ENV_READY)('an active investment still writes (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    investmentId = await createTestInvestment(payload, `${FIXTURE_PREFIX}active-${Date.now()}`)
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM investments WHERE id = ${investmentId}`)
  })

  // The control: without it, a wrapper that refused unconditionally would pass every case above.
  it('adds a section and edits its item', async () => {
    const section = await addSectionAction(investmentId)
    expect(section.success).toBe(true)
    if (!section.success) return
    expect(await updateItemFieldAction(section.data.item.id, { description: 'ok' })).toEqual({
      success: true,
    })
  })
})
