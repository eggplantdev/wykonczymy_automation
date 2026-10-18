import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import type { InspectionFormDataT } from '@/components/forms/inspection-form/inspection-schema'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { firstUserId } from '@/__tests__/helpers/first-user-id'
import { createTestVehicle } from '@/__tests__/helpers/fleet-db'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

vi.mock('@/lib/auth/get-current-user-jwt', () => import('@/__tests__/stubs/get-current-user-jwt'))

const { createInspectionAction } = await import('@/lib/actions/fleet')

describe.skipIf(!ENV_READY)('createInspectionAction — cost (DB)', () => {
  let payload: Payload
  let vehicleId = 0

  const storedRows = async () =>
    (
      await payload.find({
        collection: 'vehicle-inspections',
        where: { vehicle: { equals: vehicleId } },
        limit: 100,
        depth: 0,
      })
    ).docs

  const storedCount = async () => (await storedRows()).length

  const inspection = (overrides: Partial<InspectionFormDataT> = {}): InspectionFormDataT => ({
    vehicle: vehicleId,
    type: 'TECHNICAL',
    performedAt: '2026-08-01',
    cost: 250,
    insurer: '',
    policyNumber: '',
    note: '',
    attachments: [],
    ...overrides,
  })

  beforeAll(async () => {
    payload = await bootTestPayload()

    authState.userId = await firstUserId(payload)

    vehicleId = await createTestVehicle(payload, `TEST-COST-${Date.now()}`)
  })

  afterAll(async () => {
    // The inspections cascade with the vehicle (FK ON DELETE cascade), so one delete clears both.
    if (vehicleId) await payload.delete({ collection: 'vehicles', id: vehicleId })
  })

  // The field is optional to a human, not to a caller: `null` is the way to say „unknown", and an
  // absent key is a client that forgot the field entirely.
  it('writes nothing when the payload omits the cost key', async () => {
    const { cost: _omitted, ...withoutCost } = inspection()

    const result = await createInspectionAction(withoutCost as InspectionFormDataT)

    expect(result.success).toBe(false)
    expect(await storedCount()).toBe(0)
  })

  it('writes nothing when the cost is negative', async () => {
    const result = await createInspectionAction(inspection({ cost: -1 }))

    expect(result.success).toBe(false)
    expect(await storedCount()).toBe(0)
  })

  it('persists a zero cost as zero', async () => {
    const result = await createInspectionAction(inspection({ cost: 0 }))

    expect(result.success).toBe(true)
    expect((await storedRows())[0]?.cost).toBe(0)
  })

  it('persists an unknown cost as null, not as zero', async () => {
    const result = await createInspectionAction(inspection({ cost: null }))

    expect(result.success).toBe(true)
    expect((await storedRows())[0]?.cost).toBeNull()
  })

  it('keeps the polisa number as text', async () => {
    const result = await createInspectionAction(
      inspection({ type: 'INSURANCE', policyNumber: '22044 4672279', insurer: 'compensa' }),
    )

    expect(result.success).toBe(true)
    expect((await storedRows())[0]?.policyNumber).toBe('22044 4672279')
  })
})
