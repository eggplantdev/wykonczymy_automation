import type { Transaction } from '@/payload-types'
import { resolveId } from '@/lib/utils/resolve-id'

type TransferDataT = Partial<Transaction>

/**
 * Relationships arrive as an id from one side and as a populated document from the other, so a raw
 * compare would read „changed" on a field nobody touched.
 */
function normalize(value: unknown): unknown {
  if (value === null || value === undefined) return null
  if (Array.isArray(value)) return value.map(normalize)
  if (typeof value === 'object') return resolveId(value as Parameters<typeof resolveId>[0]) ?? value
  return value
}

function changed(next: unknown, previous: unknown): boolean {
  return JSON.stringify(normalize(next)) !== JSON.stringify(normalize(previous))
}

export function isInvoiceOnlyPatch(
  next: TransferDataT,
  previous: TransferDataT | undefined,
): boolean {
  return Object.keys(next).every(
    (key) =>
      key === 'invoice' ||
      !changed(next[key as keyof TransferDataT], previous?.[key as keyof TransferDataT]),
  )
}
