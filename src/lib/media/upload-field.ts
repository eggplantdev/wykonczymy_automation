import { resolveId } from '@/lib/utils/resolve-id'

// A hasMany upload field reads back as ids at depth 0 and as populated docs otherwise, and either
// shape can be a bare value rather than an array. The scalar forms stay accepted because a doc can
// reach here from either read and a `typeof x === 'number'` guard on the wrong one is exactly the
// bug the invoice field's migration introduced.
type UploadRefT = number | { id: number }
export type UploadFieldT = UploadRefT | UploadRefT[] | null | undefined

/** Every media id of one doc's upload field, in attachment order. */
export function uploadFieldIds(field: UploadFieldT): number[] {
  const refs = Array.isArray(field) ? field : [field]
  return refs.map(resolveId).filter((id): id is number => id !== undefined)
}
