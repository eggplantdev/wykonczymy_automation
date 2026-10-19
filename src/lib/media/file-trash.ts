import { canViewRegister, type RoleT } from '@/lib/auth/roles'
import type { DetachedFileRowT } from '@/lib/db/media-detachments'

type ParentT = DetachedFileRowT['parent']

export function canViewDetachedFile(role: RoleT, parent: ParentT): boolean {
  return parent.kind !== 'transaction' || canViewRegister(role, parent.registerType)
}

export function fileRestoreBlockedReason(parent: ParentT): string | undefined {
  if (parent.kind === 'investment' && parent.trashedAt)
    return 'Najpierw przywróć inwestycję z Kosza.'
  if (parent.kind === 'lead' && parent.trashedAt) return 'Najpierw przywróć zgłoszenie z Kosza.'
  return undefined
}
