import type { Payload } from 'payload'
import type { Equipment, Vehicle, VehicleInspection } from '@/payload-types'

type VehicleOverridesT = Partial<Omit<Vehicle, 'id' | 'registration' | 'createdAt' | 'updatedAt'>>
type EquipmentOverridesT = Partial<Omit<Equipment, 'id' | 'name' | 'createdAt' | 'updatedAt'>>

export async function createTestVehicle(
  payload: Payload,
  registration: string,
  overrides: VehicleOverridesT = {},
): Promise<number> {
  const vehicle = await payload.create({
    collection: 'vehicles',
    data: { registration, make: 'Ford', model: 'Transit', status: 'ACTIVE', ...overrides },
    overrideAccess: true,
    context: { skipRevalidation: true },
  })
  return Number(vehicle.id)
}

export async function createTestInspection(
  payload: Payload,
  vehicleId: number,
  performedAt: string,
  type: VehicleInspection['type'] = 'TECHNICAL',
): Promise<number> {
  const inspection = await payload.create({
    collection: 'vehicle-inspections',
    data: { vehicle: vehicleId, type, performedAt },
    overrideAccess: true,
    context: { skipRevalidation: true },
  })
  return Number(inspection.id)
}

export async function createTestEquipment(
  payload: Payload,
  name: string,
  overrides: EquipmentOverridesT = {},
): Promise<number> {
  const equipment = await payload.create({
    collection: 'equipment',
    data: { name, status: 'IN_USE', ...overrides },
    overrideAccess: true,
    context: { skipRevalidation: true },
  })
  return Number(equipment.id)
}
