import { describe, it, expect, beforeEach } from 'vitest'
import { updateTag, revalidateTag } from '@/__tests__/stubs/next-cache'
import { revalidateCollections, revalidateEntities } from '@/lib/cache/revalidate'
import { CACHE_TAGS } from '@/lib/cache/tags'

// `deferRefresh` exists to drop the route re-render on per-cell autosaves (EX-597), NOT to skip
// invalidation. The distinction is invisible on the editor itself — it holds `rows` in local state
// either way — and only shows up on the OTHER routes that read these tags, chiefly the client share
// link. So the invariant worth pinning is that both branches expire every tag they are given; a
// "simplification" that turned the deferred branch into a no-op would leave shared kosztorys links
// serving stale figures indefinitely, with nothing in the editor to reveal it.
describe('revalidateCollections', () => {
  beforeEach(() => {
    updateTag.mockReset()
    revalidateTag.mockReset()
  })

  it('re-renders the calling route by default', () => {
    revalidateCollections(['investments', 'kosztorysItems'])

    expect(updateTag.mock.calls.map(([tag]) => tag)).toEqual([
      CACHE_TAGS['investments'],
      CACHE_TAGS['kosztorysItems'],
    ])
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('expires without re-rendering when deferRefresh is set', () => {
    revalidateCollections(['investments', 'kosztorysItems'], { deferRefresh: true })

    // Literals, not the imported constants: asserting against the constant the impl passes is a
    // tautology that survives any value, including the two that break this branch — `'default'`,
    // which never hard-expires, and `{ expire: 0 }`, which re-renders the route EX-597 stopped
    // re-rendering. Both invariants are pinned here or nowhere.
    expect(revalidateTag.mock.calls).toEqual([
      [CACHE_TAGS['investments'], { expire: 1 }],
      [CACHE_TAGS['kosztorysItems'], { expire: 1 }],
    ])
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('invalidates every tag on both branches — deferring the refresh never skips a tag', () => {
    const slugs = ['investments', 'kosztorysItems', 'stageProgress'] as const

    revalidateCollections([...slugs])
    const immediate = updateTag.mock.calls.map(([tag]) => tag)

    revalidateCollections([...slugs], { deferRefresh: true })
    const deferred = revalidateTag.mock.calls.map(([tag]) => tag)

    expect(deferred).toEqual(immediate)
    expect(deferred).toHaveLength(slugs.length)
  })
})

// EX-849: the gallery entry is keyed on one row, and the collection slug was expiring all 65 of
// them on writes that touched none. The invariant worth pinning is that the per-row path carries
// the tag through VERBATIM — a helper that re-derived it from a slug map would silently reintroduce
// the collection-wide blast radius.
describe('revalidateEntities', () => {
  beforeEach(() => {
    updateTag.mockReset()
    revalidateTag.mockReset()
  })

  it('expires the given tags unchanged and re-renders by default', () => {
    revalidateEntities(['investment:6', 'investment:7'])

    expect(updateTag.mock.calls.map(([tag]) => tag)).toEqual(['investment:6', 'investment:7'])
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('defers the refresh on the same branch revalidateCollections uses', () => {
    revalidateEntities(['investment:6'], { deferRefresh: true })

    expect(revalidateTag.mock.calls).toEqual([['investment:6', { expire: 1 }]])
    expect(updateTag).not.toHaveBeenCalled()
  })
})
