import { resolveId } from '@/lib/utils/resolve-id'

// A hasMany upload field reads back as ids at depth 0 and as populated docs otherwise, and either
// shape can be a bare value rather than an array.
type UploadRefT = number | { id: number }
export type UploadFieldT = UploadRefT | UploadRefT[] | null | undefined

export function uploadFieldIds(field: UploadFieldT): number[] {
  const refs = Array.isArray(field) ? field : [field]
  return refs.map(resolveId).filter((id): id is number => id !== undefined)
}
