/**
 * The „exactly one target" rule, stated once for both writers of it: the collection hook that
 * guards the row (`hooks/equipment/validate.ts`) and the Zod layer that guards the action's payload
 * before it gets there. Two copies of the sentence would be two rules the moment one is reworded.
 */
export const NO_TARGET_MESSAGE = 'Wskaż, gdzie sprzęt trafia: pracownik, magazyn albo serwis.'

export const MULTIPLE_TARGETS_MESSAGE =
  'Sprzęt może trafić tylko w jedno miejsce naraz — wybierz pracownika, magazyn albo serwis.'

/** The targets a row actually names. A blank workshop is whitespace, not a destination. */
export function namedTargets(
  holder: number | null | undefined,
  warehouse: number | null | undefined,
  serviceProvider: string | null | undefined,
): (number | string)[] {
  return [holder ?? undefined, warehouse ?? undefined, serviceProvider?.trim() || undefined].filter(
    (value): value is number | string => value !== undefined,
  )
}
