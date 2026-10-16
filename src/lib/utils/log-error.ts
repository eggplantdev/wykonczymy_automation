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
