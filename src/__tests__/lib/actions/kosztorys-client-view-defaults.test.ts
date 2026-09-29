import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'

// „Zapisz jako domyślne" writes FIRM-WIDE state: the global it touches decides what every investment
// without a row of its own serves to its client link. So this asserts the PERSISTED global, not the
// action's return value.
vi.mock('server-only', () => ({}))

const authState = vi.hoisted(() => ({ role: 'OWNER' as string }))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async (roles: readonly string[]) =>
    roles.includes(authState.role)
      ? { success: true, user: { id: 0, email: 'o@t.com', name: 'Owner', role: authState.role } }
      : { success: false, error: 'Brak uprawnień' },
  ),
}))

const { saveClientViewDefaultsAction, saveClientViewSettingsAction } =
  await import('@/lib/actions/kosztorys-client-view')
const { findClientViewRow } = await import('@/lib/queries/kosztorys-client-view')
const { createTestInvestment, deleteTestInvestment } =
  await import('@/__tests__/helpers/investment')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

const SETTINGS = { hiddenColumns: ['discountValue'], hideEmptyRows: false, columnRanks: {} }

describe.skipIf(!ENV_READY)('saveClientViewDefaultsAction (DB)', () => {
  let payload: Payload

  const readGlobal = () => payload.findGlobal({ slug: 'kosztorys-client-view-defaults', depth: 0 })

  const resetGlobal = () =>
    payload.updateGlobal({
      slug: 'kosztorys-client-view-defaults',
      data: { hiddenColumns: null, hideEmptyRows: true },
    })

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    await resetGlobal()
  })

  // The global is firm-wide state, not this spec's own row: left mutated it decides what a later
  // spec's investment serves.
  afterAll(async () => {
    await resetGlobal()
  })

  it('stores the set as the firm-wide default, sanitized against the ceiling', async () => {
    const res = await saveClientViewDefaultsAction({
      ...SETTINGS,
      hiddenColumns: [...SETTINGS.hiddenColumns, 'note'],
    })

    expect(res.success).toBe(true)
    const stored = await readGlobal()
    expect(stored.hiddenColumns).toEqual(SETTINGS.hiddenColumns)
    expect(stored.hideEmptyRows).toBe(false)
  })
})

// A manager shares the link, so both the per-investment save and the firm-wide default are theirs.
describe.skipIf(!ENV_READY)('client-view saves as MANAGER (DB)', () => {
  let payload: Payload
  let investmentId: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    investmentId = await createTestInvestment(payload, 'client view manager spec')
    authState.role = 'MANAGER'
  })

  afterAll(async () => {
    authState.role = 'OWNER'
    if (investmentId) await deleteTestInvestment(payload, investmentId)
    await payload.updateGlobal({
      slug: 'kosztorys-client-view-defaults',
      data: { hiddenColumns: null, hideEmptyRows: true },
    })
  })

  it("saves this investment's settings", async () => {
    const res = await saveClientViewSettingsAction(investmentId, SETTINGS)

    expect(res.success).toBe(true)
    const row = await findClientViewRow(payload, investmentId)
    expect(row?.hiddenColumns).toEqual(SETTINGS.hiddenColumns)
    expect(row?.hideEmptyRows).toBe(false)
  })

  it('stores the firm-wide default', async () => {
    const res = await saveClientViewDefaultsAction(SETTINGS)

    expect(res.success).toBe(true)
    const stored = await payload.findGlobal({ slug: 'kosztorys-client-view-defaults', depth: 0 })
    expect(stored.hiddenColumns).toEqual(SETTINGS.hiddenColumns)
    expect(stored.hideEmptyRows).toBe(false)
  })
})
