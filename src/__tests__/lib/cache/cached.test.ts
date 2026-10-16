import { afterEach, describe, expect, it, vi } from 'vitest'

const unstableCache = vi.hoisted(() => vi.fn(<FnT>(fn: FnT) => fn))
vi.mock('next/cache', () => ({ unstable_cache: unstableCache }))

// The one invariant EX-1063 exists for: no entry is reachable from a deployment that didn't write it.
describe('cached', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    unstableCache.mockClear()
  })

  it('appends the deployment id as the last key part', async () => {
    vi.stubEnv('VERCEL_DEPLOYMENT_ID', 'dpl_abc')
    const { cached } = await import('@/lib/cache/cached')
    const options = { tags: ['collection:users'] }

    cached(async () => 1, ['session-alive', '7'], options)

    expect(unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ['session-alive', '7', 'dpl_abc'],
      options,
    )
  })

  it('keys a local process on its pid', async () => {
    vi.stubEnv('VERCEL_DEPLOYMENT_ID', undefined)
    const { cached } = await import('@/lib/cache/cached')

    cached(async () => 1)

    expect(unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      [`local-${process.pid}`],
      undefined,
    )
  })
})
