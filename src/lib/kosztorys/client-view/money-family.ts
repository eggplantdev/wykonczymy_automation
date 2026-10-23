import { CLIENT_GROSS_TWINS } from '@/lib/kosztorys/client-view/columns'
import type { ColumnGroupT } from '@/lib/kosztorys/columns/column-config'

export type MoneyFamilyT = 'net' | 'gross'

const NET_KEYS: ReadonlySet<string> = new Set(Object.keys(CLIENT_GROSS_TWINS))
const GROSS_KEYS: ReadonlySet<string> = new Set(Object.values(CLIENT_GROSS_TWINS))

export function groupsForMoneyFamily(
  groups: readonly ColumnGroupT[],
  family: MoneyFamilyT,
): readonly ColumnGroupT[] {
  if (family === 'net') return groups
  return groups.map((group) => ({
    ...group,
    keys: group.keys.map((key) => (NET_KEYS.has(key) ? CLIENT_GROSS_TWINS[key] : key)),
  }))
}

export const isListedInMoneyFamily = (key: string, family: MoneyFamilyT) =>
  !(family === 'net' ? GROSS_KEYS : NET_KEYS).has(key)
