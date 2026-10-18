import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment } from '@/__tests__/helpers/investment'
import { appendAt, insertNextTo } from '@/__tests__/helpers/new-item-input'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { firstUserId } from '@/__tests__/helpers/first-user-id'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

vi.mock('@/lib/auth/get-current-user-jwt', () => import('@/__tests__/stubs/get-current-user-jwt'))

const {
  addItemAction,
  addSectionAction,
  addStageAction,
  applyPercentDiscountToAllItemsAction,
  cleanItemTextsAction,
  clearKosztorysAction,
  insertSectionAction,
  removeItemAction,
  removeSectionAction,
  removeStageAction,
  renumberKosztorysOrderAction,
  setStageProgressAction,
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
const { insertCatalogueItemsAction } = await import('@/lib/actions/catalogue-to-kosztorys')
const { INVESTMENT_LOCKED_MESSAGE } = await import('@/lib/constants/investment-lock')

const FIXTURE_PREFIX = 'investment-lock-test-'

describe.skipIf(!ENV_READY)('a completed investment refuses every kosztorys write (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let sectionId: number
  let itemId: number
  let stageId: number

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    authState.userId = await firstUserId(payload)

    await db.execute(sql`DELETE FROM investments WHERE name LIKE ${`${FIXTURE_PREFIX}%`}`)

    // Built while still „Aktywna", then closed: the fixture has to carry a real row of each kind, or
    // a refusal would be indistinguishable from „row not found".
    investmentId = await createTestInvestment(payload, `${FIXTURE_PREFIX}${Date.now()}`)

    const section = await addSectionAction(investmentId)
    if (!section.success) throw new Error('fixture: addSectionAction failed')
    sectionId = section.data.section.id
    const item = await addItemAction(appendAt(sectionId))
    if (!item.success) throw new Error('fixture: addItemAction failed')
    itemId = item.data.item.id

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
    ['cleanItemTextsAction', () => cleanItemTextsAction(investmentId)],
    ['clearKosztorysAction', () => clearKosztorysAction(investmentId)],
    ['addSectionAction', () => addSectionAction(investmentId)],
    ['removeSectionAction', () => removeSectionAction(sectionId)],
    ['insertSectionAction', () => insertSectionAction(sectionId, 'above')],
    ['addItemAction (end)', () => addItemAction(appendAt(sectionId))],
    ['addItemAction (next-to)', () => addItemAction(insertNextTo(itemId, 'above'))],
    ['removeItemAction', () => removeItemAction(itemId)],
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

  it('still lists versions', async () => {
    expect((await listSnapshotsAction(investmentId)).success).toBe(true)
  })

  it('still saves a preset from the locked kosztorys', async () => {
    const name = `${FIXTURE_PREFIX}preset-${Date.now()}`
    expect((await savePresetAction(investmentId, { mode: 'new', name })).success).toBe(true)
    await db.execute(sql`DELETE FROM investments WHERE name = ${name}`)
  })
})

describe.skipIf(!ENV_READY)('an active investment still writes (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number

  beforeAll(async () => {
    payload = await bootTestPayload()
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
    const item = await addItemAction(appendAt(section.data.section.id))
    expect(item.success).toBe(true)
    if (!item.success) return
    expect(await updateItemFieldAction(item.data.item.id, { description: 'ok' })).toEqual({
      success: true,
    })
  })
})
