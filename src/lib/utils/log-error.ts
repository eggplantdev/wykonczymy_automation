/**
 * Single sink for runtime error logging — the seam where Sentry capture lands (EX-433).
 * Migrating a `console.error` here swaps prod visibility from N call sites to one body.
 *
 * Unwraps a Payload `ValidationError`'s `.data` (the per-field reason the default console
 * print collapses to `[Object]`) when present — a caller can never rationally opt out, so
 * it's decided by presence, not a flag.
 */
export function logError(label: string, err?: unknown, ...extra: unknown[]) {
  const base = err instanceof Error ? err.message : err
  const data = (err as { data?: unknown } | null | undefined)?.data
  console.error(
    label,
    ...(err === undefined ? [] : [base]),
    ...extra,
    ...(data === undefined ? [] : [JSON.stringify(data, null, 2)]),
  )
}
