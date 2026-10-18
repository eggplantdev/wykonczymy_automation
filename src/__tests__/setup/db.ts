import { afterAll, beforeAll, vi } from 'vitest'
import { resetAuthState } from '@/__tests__/stubs/get-current-user-jwt'

vi.mock('@/lib/auth/get-current-user-jwt', () => import('@/__tests__/stubs/get-current-user-jwt'))

// `db-shared` keeps one module instance for every file, so a role set by the previous file would
// leak into the next one's actions.
beforeAll(resetAuthState)

// `restoreMocks` restores only before each test, so a spy from a file's last test would still be
// live in the next file's beforeAll.
afterAll(() => vi.restoreAllMocks())
