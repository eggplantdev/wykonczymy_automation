import type { DbExecutorT } from '@/lib/db/get-db'
import { fetchRemovalSubject, type RemovalSubjectT } from '@/lib/db/account-removal'
import { deleteUserSessions } from '@/lib/db/user-sessions'
import { deletePushSubscriptions } from '@/lib/db/push-subscriptions'
import { assignableRoles, canManageAccount, type RoleT } from '@/lib/auth/roles'
import {
  GUARDED_ROLES,
  MANAGER_SCOPE_MESSAGE,
  SELF_REMOVAL_MESSAGE,
  lastRoleMessage,
} from '@/lib/constants/worker-lock'

// An account already in the trash takes nobody out of that count, so its delete is not refused.
export function removalRefusal(
  subject: RemovalSubjectT,
  { isSelf }: { isSelf: boolean },
): string | undefined {
  if (isSelf) return SELF_REMOVAL_MESSAGE
  if (subject.isTrashed) return undefined
  if (GUARDED_ROLES.includes(subject.role) && subject.otherLiveOfRole === 0) {
    return lastRoleMessage(subject.role)
  }
  return undefined
}

export async function accountRemovalRefusal(
  db: DbExecutorT,
  { targetId, actorId }: { targetId: number; actorId?: number },
): Promise<string | undefined> {
  const subject = await fetchRemovalSubject(db, targetId)
  if (!subject) return undefined
  return removalRefusal(subject, { isSelf: actorId === targetId })
}

// Every write that sets `role` or `active` on an account answers to this — the Local API skips the
// field access that guards them on REST.
export function accountChangeRefusal(
  subject: RemovalSubjectT,
  {
    actorRole,
    isSelf,
    next,
  }: { actorRole: RoleT; isSelf: boolean; next: { role: RoleT; active: boolean } },
): string | undefined {
  if (!isSelf && !canManageAccount(actorRole, subject.role)) return MANAGER_SCOPE_MESSAGE
  if (!assignableRoles(actorRole, subject.role).includes(next.role)) return MANAGER_SCOPE_MESSAGE
  return subject.isActive && !next.active ? removalRefusal(subject, { isSelf }) : undefined
}

// Call after the user update — the update writes the sessions array back.
export async function revokeAccountAccess(db: DbExecutorT, userId: number): Promise<void> {
  await deleteUserSessions(db, userId)
  await deletePushSubscriptions(db, userId)
}
