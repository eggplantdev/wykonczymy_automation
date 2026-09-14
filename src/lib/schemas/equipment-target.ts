import { z } from 'zod'
import { requiredDay } from '@/lib/utils/validation'
import { EQUIPMENT_TARGET_KINDS } from '@/lib/equipment/target-kinds'
import {
  MULTIPLE_TARGETS_MESSAGE,
  NO_TARGET_MESSAGE,
  namedTargets,
} from '@/lib/equipment/target-invariant'

/**
 * The target trio, shared by both forms that write an event: „Przekaż" and the first entry „Dodaj
 * sprzęt" is required to carry. One shape, so the two can't drift into disagreeing about what a
 * destination is.
 *
 * `targetKind` exists only in the form layer — it is the radio the user actually answers, and the
 * three columns are derived from it. The row has no such column: the target IS the kind.
 */
export const equipmentTargetFormShape = {
  occurredAt: requiredDay('Data przekazania jest wymagana'),
  targetKind: z.enum(EQUIPMENT_TARGET_KINDS),
  holder: z.string(),
  warehouse: z.string(),
  serviceProvider: z.string(),
}

const KIND_FIELD = {
  holder: { field: 'holder', message: 'Wskaż pracownika' },
  warehouse: { field: 'warehouse', message: 'Wskaż magazyn' },
  service: { field: 'serviceProvider', message: 'Podaj nazwę serwisu' },
} as const

type TargetFormValuesT = { [K in keyof typeof equipmentTargetFormShape]: string }

/** Form layer: the chosen kind must be answered, so the error lands ON the field the user sees. */
export function refineTargetChoice(values: TargetFormValuesT, ctx: z.RefinementCtx) {
  const { field, message } = KIND_FIELD[values.targetKind as keyof typeof KIND_FIELD]
  if (values[field].trim() === '') {
    ctx.addIssue({ code: 'custom', message, path: [field] })
  }
}

/** Domain layer, as the row stores it — `null` for the two columns the choice did not fill. */
export const equipmentTargetDataShape = {
  occurredAt: requiredDay('Data przekazania jest wymagana'),
  holder: z.number().nullable(),
  warehouse: z.number().nullable(),
  serviceProvider: z.string().nullable(),
}

type TargetDataValuesT = {
  holder: number | null
  warehouse: number | null
  serviceProvider: string | null
}

/**
 * The same „exactly one" the collection hook enforces, restated at the action's door so a bad
 * payload gets a readable field error instead of a 400 from Payload.
 */
export function refineExactlyOneTarget(values: TargetDataValuesT, ctx: z.RefinementCtx) {
  const targets = namedTargets(values.holder, values.warehouse, values.serviceProvider)
  if (targets.length === 0) ctx.addIssue({ code: 'custom', message: NO_TARGET_MESSAGE })
  if (targets.length > 1) ctx.addIssue({ code: 'custom', message: MULTIPLE_TARGETS_MESSAGE })
}

/** Form values → the three columns. Only the chosen kind survives; the other two are cleared. */
export function toTargetData(values: TargetFormValuesT): TargetDataValuesT {
  return {
    holder: values.targetKind === 'holder' ? Number(values.holder) : null,
    warehouse: values.targetKind === 'warehouse' ? Number(values.warehouse) : null,
    serviceProvider: values.targetKind === 'service' ? values.serviceProvider.trim() : null,
  }
}
