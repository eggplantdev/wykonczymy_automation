'use client'

import { startTransition, useOptimistic } from 'react'
import { InspectionTypeCheckboxes } from '@/components/fleet/inspection-type-checkboxes'
import { setVehicleFlagsAction } from '@/lib/actions/fleet'
import { PERFORMED_INSPECTION_TYPES } from '@/lib/fleet/inspection-types'
import type { PerformedInspectionTypeT } from '@/lib/fleet/inspection-types'
import { toastMessage } from '@/lib/utils/toast'

/**
 * The only place marks are edited. Ticking is optimistic — the boxes are the whole UI, so waiting on
 * the round-trip would make every click feel broken.
 *
 * `useOptimistic` rather than `useState`, because the server's set moves on its own: recording an
 * inspection from this same page retires the matching mark, and a component seeded once would keep
 * showing the tick while the badge is already gone — then re-stamp that type on the next unrelated
 * toggle. Anchoring on the prop also makes the failure path free: the tick reverts to whatever the
 * server last said, with no pre-toggle snapshot to keep.
 */
export function VehicleFlags({
  vehicleId,
  active,
}: {
  vehicleId: number
  active: PerformedInspectionTypeT[]
}) {
  const [selected, setSelected] = useOptimistic(active)

  function commit(next: PerformedInspectionTypeT[]) {
    startTransition(async () => {
      setSelected(next)

      try {
        const result = await setVehicleFlagsAction(vehicleId, next)
        if (!result.success) toastMessage(result.error, 'error')
      } catch {
        // The action never rejects on a handler throw — `protectedAction` catches those. Reaching
        // here means the request itself failed, so nothing was persisted.
        // TODO(EX-958) SENTRY-REQUIRED: transport failure on setVehicleFlagsAction
        toastMessage('Nie udało się zapisać oznaczenia — spróbuj ponownie.', 'error')
      }
    })
  }

  return (
    <InspectionTypeCheckboxes
      types={PERFORMED_INSPECTION_TYPES}
      selected={selected}
      onChange={commit}
    />
  )
}
