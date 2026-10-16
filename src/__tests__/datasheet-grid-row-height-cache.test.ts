import Module from 'node:module'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

/**
 * Reaches into patched third-party dist (`patches/react-datasheet-grid@4.11.6.patch`) — a lost patch
 * on reinstall brings the crash back silently.
 */
function loadRowHeightsHook(): BuildCacheT {
  const slots = new Map<number, { current: unknown }>()
  let slot = 0
  const react = {
    useRef: (initial: unknown) => {
      const existing = slots.get(slot) ?? { current: initial }
      slots.set(slot++, existing)
      return existing
    },
    useState: (initial: unknown) => [initial, () => {}],
    useMemo: (factory: () => unknown) => factory(),
  }

  const require = createRequire(import.meta.url)
  const moduleInternals = Module as unknown as {
    _resolveFilename: (request: string, ...rest: unknown[]) => string
  }
  const resolve = moduleInternals._resolveFilename
  const reactId = 'stub:react'
  moduleInternals._resolveFilename = function (request, ...rest) {
    return request === 'react' ? reactId : resolve.call(this, request, ...rest)
  }
  require.cache[reactId] = { id: reactId, loaded: true, exports: react } as NodeJS.Module
  try {
    return require('react-datasheet-grid/dist/hooks/useRowHeights').useRowHeights as BuildCacheT
  } finally {
    moduleInternals._resolveFilename = resolve
  }
}

// Not named `use…`: it is a hook only inside React, and here it is a plain factory — the lint rule
// reads the call site by name alone.
type BuildCacheT = (opts: unknown) => RowHeightCacheT

type RowHeightCacheT = {
  getRowSize: (index: number) => { height: number; top: number }
  resetAfter: (index: number) => void
  totalSize: (maxHeight: number) => number
}

const BAND_HEIGHT = 52
const ITEM_HEIGHT = 32

const buildRowHeightCache = loadRowHeightsHook()

function rowHeightCache(): RowHeightCacheT {
  return buildRowHeightCache({
    value: Array.from({ length: 50 }, (_, id) => ({ id })),
    // Row 0 is a section band — the shape that makes a reset from index 0 reachable at all.
    rowHeight: ({ rowIndex }: { rowIndex: number }) => (rowIndex === 0 ? BAND_HEIGHT : ITEM_HEIGHT),
  })
}

describe('dsg row-height cache after a reset from index 0', () => {
  it('measures a row once the cache is empty', () => {
    const cache = rowHeightCache()
    cache.getRowSize(10)
    cache.resetAfter(0)

    expect(() => cache.getRowSize(10)).not.toThrow()
  })

  it('measures the whole grid, not just its first row', () => {
    const cache = rowHeightCache()
    const total = BAND_HEIGHT + 49 * ITEM_HEIGHT

    expect(cache.totalSize(10_000)).toBe(total)
    cache.resetAfter(0)
    expect(cache.totalSize(10_000)).toBe(total)
  })

  it('rebuilds the offsets from zero rather than from a stale last entry', () => {
    const cache = rowHeightCache()
    cache.getRowSize(10)
    cache.resetAfter(0)

    expect(cache.getRowSize(10)).toEqual({
      height: ITEM_HEIGHT,
      top: BAND_HEIGHT + 9 * ITEM_HEIGHT,
    })
  })
})
