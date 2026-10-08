const NIP_DIGITS = /^\d{10}$/

/** A NIP as printed (`PL 937-249-23-52`) → its 10 digits, or `undefined` when it isn't one. */
export function normalizeNip(raw: string): string | undefined {
  const digits = raw.trim().replace(/^PL/i, '').replace(/[\s-]/g, '')
  return NIP_DIGITS.test(digits) ? digits : undefined
}
