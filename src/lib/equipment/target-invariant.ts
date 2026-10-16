export const NO_TARGET_MESSAGE = 'Wskaż, gdzie sprzęt trafia: pracownik, magazyn albo serwis.'

export const MULTIPLE_TARGETS_MESSAGE =
  'Sprzęt może trafić tylko w jedno miejsce naraz — wybierz pracownika, magazyn albo serwis.'

export function namedTargets(
  holder: number | null | undefined,
  warehouse: number | null | undefined,
  serviceProvider: string | null | undefined,
): (number | string)[] {
  return [holder ?? undefined, warehouse ?? undefined, serviceProvider?.trim() || undefined].filter(
    (value): value is number | string => value !== undefined,
  )
}
