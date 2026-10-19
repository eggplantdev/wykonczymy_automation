import { APIError, type CollectionBeforeValidateHook } from 'payload'
import type { EquipmentEvent } from '@/payload-types'
import { resolveId } from '@/lib/utils/resolve-id'
import { getDb } from '@/lib/db/get-db'
import { trashedWorkerMessage } from '@/lib/db/worker-gate'
import {
  MULTIPLE_TARGETS_MESSAGE,
  NO_TARGET_MESSAGE,
  namedTargets,
} from '@/lib/equipment/target-invariant'

type EventDataT = Partial<EquipmentEvent>

export const validateEquipmentEvent: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  req,
}) => {
  const d = data as EventDataT
  const original = originalDoc as EventDataT | undefined

  // Keyed on PRESENCE, not truthiness: /admin saves the whole document, so a cleared relationship
  // arrives as an explicit `null` and must reach the checks below as the emptiness it is rather
  // than silently reading the old link off the stored row.
  const resolved = <K extends keyof EventDataT>(field: K) =>
    field in d ? d[field] : original?.[field]

  const holder = resolveId(resolved('holder'))
  const warehouse = resolveId(resolved('warehouse'))
  const serviceProvider = resolved('serviceProvider')?.toString().trim() || undefined

  const targets = namedTargets(holder, warehouse, serviceProvider)

  if (targets.length === 0) {
    throw new APIError(NO_TARGET_MESSAGE, 400)
  }

  if (targets.length > 1) {
    throw new APIError(MULTIPLE_TARGETS_MESSAGE, 400)
  }

  if (holder !== undefined && holder !== resolveId(original?.holder)) {
    const trashed = await trashedWorkerMessage(await getDb(req.payload, req), [holder])
    if (trashed) throw new APIError(trashed, 403)
  }

  // Normalised here rather than trusted from the caller, so the „gdzie jest" query can read the
  // three columns as mutually exclusive whatever wrote the row.
  if (holder === undefined) d.holder = null
  if (warehouse === undefined) d.warehouse = null
  d.serviceProvider = serviceProvider ?? null

  // On a handover there is nothing to pay for, and a stray amount there would be summed into what the
  // company spent servicing the item.
  if (serviceProvider === undefined && 'cost' in d) d.cost = null

  // Nulled on the row rather than merely hidden in the form, because the listing reads `investment_id`
  // off the newest event unconditionally — a row written from /admin would render „leży w magazynie,
  // na inwestycji X" as a fact.
  if (holder === undefined && 'investment' in d) d.investment = null

  return d
}
