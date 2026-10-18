import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { firstUserId } from '@/__tests__/helpers/user'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

const { updateInvestmentCoeffsAction } = await import('@/lib/actions/kosztorys')

describe.skipIf(!ENV_READY)('mnożnik inwestycji — dolna granica (DB)', () => {
  let payload: Payload
  let investmentId: number

  beforeAll(async () => {
    payload = await bootTestPayload()
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
