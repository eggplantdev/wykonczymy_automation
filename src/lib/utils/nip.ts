const NIP_DIGITS = /^\d{10}$/

export function normalizeNip(raw: string): string | undefined {
  const digits = raw.trim().replace(/^PL/i, '').replace(/[\s-]/g, '')
  return NIP_DIGITS.test(digits) ? digits : undefined
}
