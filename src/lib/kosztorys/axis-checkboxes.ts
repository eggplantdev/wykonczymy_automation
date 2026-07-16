export type PairChecksT = { a: boolean; b: boolean }
export type PairAxisConfigT<T extends string> = { a: T; b: T; both: T }

export function derivePairChecks<T extends string>(
  value: T,
  config: PairAxisConfigT<T>,
): PairChecksT {
  if (value === config.both) return { a: true, b: true }
  return { a: value === config.a, b: value === config.b }
}

// Flips the clicked box. Clearing the last checked box has no valid axis value
// (there is no "hide all" state), so it is a no-op — a box always stays checked.
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
  return value
}
