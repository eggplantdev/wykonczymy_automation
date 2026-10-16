import { describe, it, expect } from 'vitest'
import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import {
  ALL_PLANE_PRICE_KEYS,
  PLANE_PRICE_BASE_KEYS,
  basePriceKey,
  planeOfPriceKey,
  planePriceKey,
  planePriceKeysFor,
} from '@/lib/kosztorys/plane-price-keys'

describe('planePriceKeyParts / planeOfPriceKey — anything outside the namespace is null', () => {
  it.each([
    'price',
    'priceMode',
    'price__client',
    'price__bogus',
    'priceRatio__w_tools',
    // Neighbouring namespaces that a naive split on '_' would swallow.
    'stage_7',
    'stageValueNet_7',
    'stageValueGross_7',
    '',
    '__',
    'price__',
    '__w_tools',
  ])('%s resolves to no plane', (key) => {
    expect(planeOfPriceKey(key)).toBeNull()
  })

  it('a well-formed key resolves to its own plane, never a default', () => {
    for (const plane of TOOL_PLANES) {
      for (const base of PLANE_PRICE_BASE_KEYS) {
        expect(planeOfPriceKey(planePriceKey(base, plane))).toBe(plane)
      }
    }
  })
})

describe('basePriceKey', () => {
  it('resolves a plane key to the base the config maps are keyed by', () => {
    for (const plane of TOOL_PLANES) {
      for (const base of PLANE_PRICE_BASE_KEYS) {
        expect(basePriceKey(planePriceKey(base, plane))).toBe(base)
      }
    }
  })

  it('leaves a foreign id exactly as it was', () => {
    for (const key of ['price', 'stage_7', 'divergence', 'price__bogus']) {
      expect(basePriceKey(key)).toBe(key)
    }
  })
})

describe('enumerations', () => {
  it('names every plane × base key exactly once', () => {
    expect(ALL_PLANE_PRICE_KEYS).toHaveLength(TOOL_PLANES.length * PLANE_PRICE_BASE_KEYS.length)
    expect(new Set(ALL_PLANE_PRICE_KEYS).size).toBe(ALL_PLANE_PRICE_KEYS.length)
    for (const key of ALL_PLANE_PRICE_KEYS) expect(planeOfPriceKey(key)).not.toBeNull()
  })

  it('a plane enumeration names only that plane', () => {
    for (const plane of TOOL_PLANES) {
      for (const key of planePriceKeysFor(plane)) expect(planeOfPriceKey(key)).toBe(plane)
    }
  })
})
