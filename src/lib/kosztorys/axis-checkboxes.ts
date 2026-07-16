export type PairChecksT = { a: boolean; b: boolean }
export type PairAxisConfigT<T extends string> = { a: T; b: T; both: T; none: T }

export function derivePairChecks<T extends string>(
  value: T,
  config: PairAxisConfigT<T>,
): PairChecksT {
  if (value === config.both) return { a: true, b: true }
  if (value === config.none) return { a: false, b: false }
  return { a: value === config.a, b: value === config.b }
}

// Flips the clicked box and maps the resulting pair back to an axis value. Clearing both boxes is
// allowed and resolves to `none` (hide this axis' columns) — no min-one guard, an empty table is a
// legitimate view.
export function togglePairAxis<T extends string>(
  value: T,
  clicked: 'a' | 'b',
  config: PairAxisConfigT<T>,
): T {
  const current = derivePairChecks(value, config)
  const next = { ...current, [clicked]: !current[clicked] }
  if (next.a && next.b) return config.both
  if (next.a) return config.a
  if (next.b) return config.b
  return config.none
}
