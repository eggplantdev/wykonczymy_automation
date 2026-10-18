import { beforeEach, vi } from 'vitest'
import { scheduled } from '@/__tests__/stubs/next-server'

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (await import('@/__tests__/stubs/next-server')).after,
}))

// `revalidate.test.ts` tests the real module and opts out with `vi.unmock`.
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

beforeEach(() => {
  scheduled.length = 0
})
