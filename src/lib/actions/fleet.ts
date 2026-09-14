'use server'

import { z } from 'zod'
import {
  vehicleSchema,
  type VehicleFormDataT,
} from '@/components/forms/vehicle-form/vehicle-schema'
import {
  inspectionSchema,
  type InspectionFormDataT,
} from '@/components/forms/inspection-form/inspection-schema'
import { warsawToday } from '@/lib/utils/days'
import { activeFlags, nextFlags, parseVehicleFlags } from '@/lib/fleet/flags'
import {
  PERFORMED_INSPECTION_TYPES,
  type PerformedInspectionTypeT,
} from '@/lib/fleet/inspection-types'
import { toInspectionEvent } from '@/lib/fleet/map-inspection'
import { assertCompletePage } from '@/lib/queries/assert-complete-page'
import { validateAction, protectedAction } from './run-action'

const flagsSchema = z.array(z.enum(PERFORMED_INSPECTION_TYPES))

export async function createVehicleAction(data: VehicleFormDataT) {
  return protectedAction(
    'createVehicleAction',
    async ({ payload }) => {
      const parsed = validateAction(vehicleSchema, data)
      if (!parsed.success) return parsed

      await payload.create({ collection: 'vehicles', data: parsed.data })

      return { success: true }
    },
    ['vehicles'],
  )
}

export async function updateVehicleAction(id: number, data: VehicleFormDataT) {
  return protectedAction(
    'updateVehicleAction',
    async ({ payload }) => {
      const parsed = validateAction(vehicleSchema, data)
      if (!parsed.success) return parsed

      await payload.update({ collection: 'vehicles', id, data: parsed.data })

      return { success: true }
    },
    ['vehicles'],
  )
}

export async function createInspectionAction(data: InspectionFormDataT) {
  return protectedAction(
    'createInspectionAction',
    async ({ payload }) => {
      const parsed = validateAction(inspectionSchema, data)
      if (!parsed.success) return parsed

      // The notification-bookkeeping columns are deliberately left unset: a fresh event is the new
      // current deadline for its (vehicle, type) pair, so it starts out un-notified on both legs and
      // the superseded row stops being read at all.
      await payload.create({ collection: 'vehicle-inspections', data: parsed.data })

      return { success: true }
    },
    ['vehicleInspections'],
  )
}

/**
 * Persist the „do wymiany" marks ticked on a vehicle. The events are read first because `nextFlags`
 * needs to know which marks the history has already answered — see its own note for why.
 */
export async function setVehicleFlagsAction(vehicleId: number, types: PerformedInspectionTypeT[]) {
  return protectedAction(
    'setVehicleFlagsAction',
    async ({ payload }) => {
      const parsed = validateAction(flagsSchema, types)
      if (!parsed.success) return parsed

      const vehicle = await payload.findByID({ collection: 'vehicles', id: vehicleId, depth: 0 })
      const inspections = await payload.find({
        collection: 'vehicle-inspections',
        where: { vehicle: { equals: vehicleId } },
        limit: 1000,
        depth: 0,
      })

      const current = parseVehicleFlags(vehicle.flags)
      // Every event of the type has to be seen: a truncated page hides the inspection that already
      // answered a mark, and `nextFlags` would then re-stamp it as freshly ticked.
      const events = assertCompletePage(inspections, 'setVehicleFlagsAction').map(toInspectionEvent)
      const today = warsawToday()

      await payload.update({
        collection: 'vehicles',
        id: vehicleId,
        data: {
          flags: nextFlags({
            current,
            active: activeFlags(current, events, today),
            selected: parsed.data,
            today,
          }),
        },
      })

      return { success: true }
    },
    ['vehicles'],
  )
}
