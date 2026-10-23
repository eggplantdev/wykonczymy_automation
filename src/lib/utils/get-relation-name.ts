import { EMPTY_VALUE } from '@/lib/utils/empty-value'

export const EMPTY_RELATION_NAME = EMPTY_VALUE

export function getRelationName(field: unknown, fallback = EMPTY_RELATION_NAME): string {
  if (typeof field === 'object' && field !== null && 'name' in field) {
    return (field as { name: string }).name
  }
  return fallback
}
