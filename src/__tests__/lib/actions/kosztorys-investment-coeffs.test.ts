import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { authState } from '@/__tests__/stubs/require-auth'
import { firstUserId } from '@/__tests__/helpers/first-user-id'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => import('@/__tests__/stubs/require-auth'))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const { updateInvestmentCoeffsAction } = await import('@/lib/actions/kosztorys')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('mnożnik inwestycji — dolna granica (DB)', () => {
  let payload: Payload
  let investmentId: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    authState.userId = await firstUserId(payload)
    investmentId = await createTestInvestment(payload, `investment-coeffs-test-${Date.now()}`, {
      wToolsCoeff: 0.6,
    })
  })

  afterAll(async () => {
    await deleteTestInvestment(payload, investmentId)
  })

  it('odmawia mnożnika ujemnego i zostawia zapisany', async () => {
    const result = await updateInvestmentCoeffsAction(investmentId, { wToolsCoeff: -0.2 })

    expect(result.success).toBe(false)
    const stored = await payload.findByID({
      collection: 'investments',
      id: investmentId,
      depth: 0,
      overrideAccess: true,
    })
    expect(stored.wToolsCoeff).toBe(0.6)
  })

  it('przyjmuje zero', async () => {
    expect(await updateInvestmentCoeffsAction(investmentId, { ownToolsCoeff: 0 })).toEqual({
      success: true,
    })
  })
})
