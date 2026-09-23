import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import type { InspectionFormDataT } from '@/components/forms/inspection-form/inspection-schema'

// „Koszt" may be unknown again — the sheet import carries no prices — but the invariant EX-729
// bought survives: `0` still means „it cost nothing", and unknown is `null`, never `0`. Collapsing
// the two is silent, so this drives the REAL DB and asserts the PERSISTED value rather than the
// action's return: a `success: true` proves it returned, not what it wrote.
//
// Same mock surface as the sibling action specs: requireAuth needs a request/cookie we lack in node,
// and revalidation touches next/cache outside a request context.
const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const { createInspectionAction } = await import('@/lib/actions/fleet')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

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
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })

    const users = await payload.find({ collection: 'users', limit: 1, depth: 0 })
    const firstUser = users.docs[0]
    if (!firstUser) throw new Error('no user in the DB to attribute the action to')
    authState.userId = Number(firstUser.id)

    const created = await payload.create({
      collection: 'vehicles',
      data: {
        registration: `TEST-COST-${Date.now()}`,
        make: 'Ford',
        model: 'Transit',
        status: 'ACTIVE',
      },
    })
    vehicleId = Number(created.id)
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

  // Zero is a legitimate price — a warranty repair costs the company nothing — and must survive as
  // itself, not be laundered into „unknown".
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
