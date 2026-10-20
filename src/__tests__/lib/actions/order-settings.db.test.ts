import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

const { saveOrderSettingsAction, setDefaultSupplierAction } =
  await import('@/lib/actions/order-settings')
const { readOrderSettings } = await import('@/lib/orders/read-order-settings')

const ALFA = { id: 'supplier-alfa', name: 'Alfa Kontenery', phone: '601 000 001' }
const BETA = { id: 'supplier-beta', name: 'Beta Wywóz', phone: '601 000 002' }

const BASELINE = {
  suppliers: [ALFA, BETA],
  bigBagPrice: 800,
  containerPrice: 1500,
  defaultBigBagSupplierId: ALFA.id,
  defaultContainerSupplierId: BETA.id,
}

describe.skipIf(!ENV_READY)('order settings actions (DB)', () => {
  let payload: Payload
  let original: Awaited<ReturnType<typeof readOrderSettings>>

  const resetGlobal = () => payload.updateGlobal({ slug: 'order-settings', data: BASELINE })

  beforeAll(async () => {
    payload = await bootTestPayload()
    original = await readOrderSettings(payload)
  })

  beforeEach(async () => {
    authState.role = 'OWNER'
    await resetGlobal()
  })

  // Firm-wide state: left mutated it decides which supplier a later spec's SMS goes to.
  afterAll(async () => {
    authState.role = 'OWNER'
    await payload.updateGlobal({
      slug: 'order-settings',
      data: {
        ...original,
        defaultBigBagSupplierId: original.defaultBigBagSupplierId ?? null,
        defaultContainerSupplierId: original.defaultContainerSupplierId ?? null,
      },
    })
  })

  it('stores the sent defaults when their rows survive the save', async () => {
    const result = await saveOrderSettingsAction({
      suppliers: [ALFA, BETA, { name: 'Gamma', phone: '601 000 003' }],
      bigBagPrice: 900,
      containerPrice: 1600,
      defaultBigBagSupplierId: ALFA.id,
      defaultContainerSupplierId: BETA.id,
    })

    expect(result.success).toBe(true)
    const stored = await readOrderSettings(payload)
    expect(stored).toMatchObject({
      bigBagPrice: 900,
      containerPrice: 1600,
      defaultBigBagSupplierId: ALFA.id,
      defaultContainerSupplierId: BETA.id,
    })
    expect(stored.suppliers.map((row) => row.name)).toEqual([
      'Alfa Kontenery',
      'Beta Wywóz',
      'Gamma',
    ])
    expect(stored.suppliers[0].id).toBe(ALFA.id)
  })

  it('sets a default to a supplier added in the same save', async () => {
    const GAMMA = { id: 'supplier-gamma', name: 'Gamma', phone: '601 000 003' }
    await saveOrderSettingsAction({
      ...BASELINE,
      suppliers: [ALFA, BETA, GAMMA],
      defaultContainerSupplierId: GAMMA.id,
    })

    expect(await readOrderSettings(payload)).toMatchObject({
      defaultBigBagSupplierId: ALFA.id,
      defaultContainerSupplierId: GAMMA.id,
    })
  })

  it('clears a default left unset', async () => {
    await saveOrderSettingsAction({ ...BASELINE, defaultContainerSupplierId: undefined })

    expect(await readOrderSettings(payload)).toMatchObject({
      defaultBigBagSupplierId: ALFA.id,
      defaultContainerSupplierId: undefined,
    })
  })

  it('clears only the default whose row is removed', async () => {
    await saveOrderSettingsAction({ ...BASELINE, suppliers: [BETA] })

    expect(await readOrderSettings(payload)).toMatchObject({
      defaultBigBagSupplierId: undefined,
      defaultContainerSupplierId: BETA.id,
    })
  })

  it("sets one kind's default and leaves the other, the list and the prices alone", async () => {
    authState.role = 'MANAGER'
    expect((await setDefaultSupplierAction('container', ALFA.id)).success).toBe(true)

    expect(await readOrderSettings(payload)).toEqual({
      ...BASELINE,
      defaultContainerSupplierId: ALFA.id,
    })
  })

  it('refuses an unknown supplier id', async () => {
    expect((await setDefaultSupplierAction('bigBag', 'supplier-ghost')).success).toBe(false)
    expect(await readOrderSettings(payload)).toEqual(BASELINE)
  })

  it('refuses an unknown item kind', async () => {
    expect((await setDefaultSupplierAction('skip' as never, BETA.id)).success).toBe(false)
    expect(await readOrderSettings(payload)).toEqual(BASELINE)
  })

  it('refuses a MANAGER on the save', async () => {
    authState.role = 'MANAGER'
    const result = await saveOrderSettingsAction({
      suppliers: [],
      bigBagPrice: 1,
      containerPrice: 1,
    })

    expect(result.success).toBe(false)
    expect(await readOrderSettings(payload)).toEqual(BASELINE)
  })

  it('refuses a zero price and writes nothing', async () => {
    const result = await saveOrderSettingsAction({
      suppliers: [ALFA],
      bigBagPrice: 0,
      containerPrice: 1500,
    })

    expect(result.success).toBe(false)
    expect(await readOrderSettings(payload)).toEqual(BASELINE)
  })

  it('refuses a price with three decimals and writes nothing', async () => {
    const result = await saveOrderSettingsAction({
      suppliers: [ALFA],
      bigBagPrice: 800.125,
      containerPrice: 1500,
    })

    expect(result.success).toBe(false)
    expect(await readOrderSettings(payload)).toEqual(BASELINE)
  })
})
