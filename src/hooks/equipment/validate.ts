import { APIError, type CollectionBeforeValidateHook } from 'payload'
import type { EquipmentEvent } from '@/payload-types'
import { resolveId } from '@/lib/utils/resolve-id'
import {
  MULTIPLE_TARGETS_MESSAGE,
  NO_TARGET_MESSAGE,
  namedTargets,
} from '@/lib/equipment/target-invariant'

type EventDataT = Partial<EquipmentEvent>

/**
 * An event points at EXACTLY ONE target: a person, a warehouse, or a workshop.
 *
 * Here rather than in the server action because the invariant belongs to the ROW, and the action is
 * one of at least three writers — /admin and the Local API write the same table. There is no
 * event-`type` column on purpose: the target IS the kind. A row naming a workshop is a service
 * entry; a row naming a person or a warehouse is a handover. A second column saying the same thing
 * would be the first thing to disagree with itself.
 */
export const validateEquipmentEvent: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  const d = data as EventDataT
  const original = originalDoc as EventDataT | undefined

  // Keyed on PRESENCE, not truthiness: /admin saves the whole document, so a cleared relationship
  // arrives as an explicit `null` and must reach the checks below as the emptiness it is rather
  // than silently reading the old link off the stored row. A partial PATCH names neither key and
  // legitimately falls back — but one that names a DIFFERENT target than the stored row now holds
  // two and is refused. That is deliberate: the history is append-only, so moving an item is a new
  // event, never an edit of the one that put it where it is.
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

  // Normalised here rather than trusted from the caller, so the „gdzie jest" query can read the
  // three columns as mutually exclusive whatever wrote the row. An empty-string workshop is a
  // non-target and must not survive as one.
  if (holder === undefined) d.holder = null
  if (warehouse === undefined) d.warehouse = null
  d.serviceProvider = serviceProvider ?? null

  // A cost belongs to a repair. On a handover there is nothing to pay for, and a stray amount there
  // would be summed into what the company spent servicing the item.
  if (serviceProvider === undefined && 'cost' in d) d.cost = null

  // „Na co to wziął" is a question about a person. A magazyn is where things wait BETWEEN jobs and a
  // serwis belongs to the tool, so neither can carry one. Nulled on the row rather than merely hidden
  // in the form, because the listing reads `investment_id` off the newest event unconditionally — a
  // row written from /admin would render „leży w magazynie, na inwestycji X" as a fact.
  if (holder === undefined && 'investment' in d) d.investment = null

  return d
}
