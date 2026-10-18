import FileSystemCache from 'next/dist/server/lib/incremental-cache/file-system-cache'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Next's server installs this global at boot; its async storages throw without it.
vi.hoisted(async () => {
  ;(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = (
    await import('node:async_hooks')
  ).AsyncLocalStorage
})

// The alias swaps `next/cache` for a passthrough stub, under which there is no cache to race.
vi.mock('next/cache', async () => ({
  unstable_cache: (await import('next/dist/server/web/spec-extension/unstable-cache'))
    .unstable_cache,
}))

const TAG = 'collection:notification-recipients'

// Next's own handler, so the spec asserts Next's expiry rule rather than a fake of it.
function installIncrementalCache(): FileSystemCache {
  const handler = new FileSystemCache({
    fs: undefined as never,
    flushToDisk: false,
    serverDistDir: '/nonexistent',
    revalidatedTags: [],
    maxMemoryCacheSize: 1024 * 1024,
    _requestHeaders: {},
  })
  ;(globalThis as { __incrementalCache?: unknown }).__incrementalCache = Object.assign(handler, {
    generateCacheKey: async (key: string) => key,
    isOnDemandRevalidate: false,
  })
  return handler
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 5))

async function loadCached(deploymentId: string) {
  vi.resetModules()
  vi.stubEnv('VERCEL_DEPLOYMENT_ID', deploymentId)
  return (await import('@/lib/cache/cached')).cached
}

describe('cached', () => {
  let handler: FileSystemCache

  beforeEach(() => {
    handler = installIncrementalCache()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    delete (globalThis as { __incrementalCache?: unknown }).__incrementalCache
  })

  it('serves a second read from the cache', async () => {
    const cached = await loadCached(`dpl_hit_${Date.now()}`)
    const read = vi.fn(async () => 'rows')
    const readRows = cached(read, ['hit'], { tags: [TAG] })

    await readRows()
    await readRows()

    expect(read).toHaveBeenCalledTimes(1)
  })

  it('does not hand one deployment the entry another one built', async () => {
    const stamp = Date.now()
    const fromOld = (await loadCached(`dpl_old_${stamp}`))(async () => 'old shape', ['deploy'], {
      tags: [TAG],
    })
    await fromOld()

    const fromNew = (await loadCached(`dpl_new_${stamp}`))(async () => 'new shape', ['deploy'], {
      tags: [TAG],
    })

    expect(await fromNew()).toBe('new shape')
  })

  it('a refill that read before a write does not outlive the write', async () => {
    const cached = await loadCached(`dpl_race_${Date.now()}`)
    let row = 'before'
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    let calls = 0
    const readRows = cached(
      async () => {
        const seen = row
        calls += 1
        if (calls === 1) await gate
        return seen
      },
      ['race'],
      { tags: [TAG] },
    )

    const prefetch = readRows()
    await tick()
    row = 'after'
    await handler.revalidateTag([TAG], { expire: 0 })
    await tick()
    release()
    expect(await prefetch).toBe('before')
    await tick()

    expect(await readRows()).toBe('after')
  })
})
