export const UNIQUE_VIOLATION = '23505'

export function hasPgCode(error: unknown, codes: readonly string[]): boolean {
  // Drizzle wraps the driver error, so the pg code sits somewhere down the `cause` chain.
  for (let current: unknown = error; current instanceof Error; current = current.cause) {
    const { code } = current as { code?: unknown }
    if (typeof code === 'string' && codes.includes(code)) return true
  }
  return false
}
