import type { DbExecutorT } from '@/lib/db/get-db'
import { fetchRemovalSubject, type RemovalSubjectT } from '@/lib/db/account-removal'
import { GUARDED_ROLES, SELF_REMOVAL_MESSAGE, lastRoleMessage } from '@/lib/constants/worker-lock'

/**
 * Nobody removes their own account, and the last account able to administer the firm stays. Counted
 * per role among accounts that can still log in, because a trashed or deactivated OWNER is refused at
 * login. An account already in the trash takes nobody out of that count, so its delete is not refused.
 */
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

/** `actorId` is absent for the purge cron, which removes nobody's own account. */
export async function accountRemovalRefusal(
  db: DbExecutorT,
  { targetId, actorId }: { targetId: number; actorId?: number },
): Promise<string | undefined> {
  const subject = await fetchRemovalSubject(db, targetId)
  if (!subject) return undefined
  return removalRefusal(subject, { isSelf: actorId === targetId })
}
