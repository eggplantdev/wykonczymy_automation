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

/**
 * The one write EX-748 leaves open on a zakończona inwestycja: attaching or detaching a scan of the
 * faktura. It cannot be read off the KEYS of `data` — Payload hands `beforeValidate` the stored row
 * with the patch merged over it, so every field is always present and a key-based test would call
 * the whole document a patch of itself. What the caller actually sent shows only in the VALUES that
 * differ from the stored row.
 *
 * Fields whose value is unchanged count as untouched no matter who put them there, so a payload that
 * echoes the whole document back (the admin panel does exactly that) is still invoice-only.
 */
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
