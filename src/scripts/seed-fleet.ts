import type { Payload } from 'payload'

const ctx = { context: { skipRevalidation: true, skipSheetSync: true } }

const COST_TECHNICAL = 1500
const COST_OIL = 900

const PERFORMED_TECHNICAL = '2020-03-15'
const PERFORMED_OIL = '2019-03-15'

export async function seedFleet(payload: Payload) {
  const stamp = Date.now()
  const prefix = `E2E${stamp}`

  const costs = await payload.create({
    collection: 'vehicles',
    data: {
      registration: `${prefix}K`,
      make: 'Ford',
      model: 'Transit',
      status: 'ACTIVE',
      exemptions: [],
    },
    ...ctx,
  })

  const exempt = await payload.create({
    collection: 'vehicles',
    data: {
      registration: `${prefix}Z`,
      make: 'Renault',
      model: 'Master',
      status: 'ACTIVE',
      exemptions: [],
    },
    ...ctx,
  })

  const inspections = [
    { type: 'TECHNICAL', performedAt: PERFORMED_TECHNICAL, cost: COST_TECHNICAL },
    { type: 'OIL_CHANGE', performedAt: PERFORMED_OIL, cost: COST_OIL },
  ] as const

  for (const inspection of inspections) {
    await payload.create({
      collection: 'vehicle-inspections',
      data: { vehicle: costs.id, ...inspection },
      ...ctx,
    })
  }

  const seed = {
    prefix,
    costs: { id: costs.id, registration: costs.registration },
    exempt: { id: exempt.id, registration: exempt.registration },
  }

  return seed
}
