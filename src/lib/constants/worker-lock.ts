import { ROLE_LABELS, type RoleT } from '@/lib/auth/roles'

// Its own module because collection hooks read it, and `server-only` throws in the Payload CLI graph.

export const WORKER_TRASHED_MESSAGE = 'Pracownik jest w koszu — przywróć go, żeby coś zmienić.'

export const OWNER_TRASHED_RESTORE_MESSAGE = 'Przywróć pracownika — kasa wraca razem z nim.'

export const SELF_REMOVAL_MESSAGE = 'Nie można przenieść do kosza ani usunąć własnego konta.'

export const lastRoleMessage = (role: RoleT): string =>
  `Nie można usunąć ostatniego aktywnego konta z rolą „${ROLE_LABELS[role].pl}".`

/** The roles an account must keep at least one live holder of — nobody else can administer them. */
export const GUARDED_ROLES: readonly RoleT[] = ['OWNER', 'ADMIN']

/**
 * `loginAction` maps errors by `name` (Payload's own `LockedAuth` works the same way), and a bundled
 * class's `constructor.name` does not survive minification — so the name is pinned, not inferred.
 */
export const DISABLED_ACCOUNT_ERROR = 'DisabledAccount'

export const DISABLED_ACCOUNT_MESSAGE =
  'To konto jest wyłączone. Skontaktuj się z właścicielem firmy.'
