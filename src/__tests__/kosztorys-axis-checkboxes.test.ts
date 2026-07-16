import { describe, expect, it } from 'vitest'
import {
  derivePairChecks,
  togglePairAxis,
  type PairAxisConfigT,
} from '@/lib/kosztorys/axis-checkboxes'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import type { LayerT } from '@/lib/kosztorys/layer'

const MONEY: PairAxisConfigT<MoneyAxisT> = { a: 'net', b: 'gross', both: 'both' }
const LAYER: PairAxisConfigT<LayerT> = { a: 'work', b: 'progress', both: 'both' }

// One suite per config: the mapper is generic, but both real call sites must round-trip.
describe.each([
  { name: 'oś kwot (netto/brutto)', config: MONEY },
  { name: 'oś warstw (praca/postęp)', config: LAYER },
])('derivePairChecks + togglePairAxis — $name', ({ config }) => {
  it('derivePairChecks mapuje trzy wartości na pary boolean', () => {
    expect(derivePairChecks(config.both, config)).toEqual({ a: true, b: true })
    expect(derivePairChecks(config.a, config)).toEqual({ a: true, b: false })
    expect(derivePairChecks(config.b, config)).toEqual({ a: false, b: true })
  })

  it('odznaczenie jednej strony z „oba" zawęża do drugiej', () => {
    expect(togglePairAxis(config.both, 'a', config)).toBe(config.b)
    expect(togglePairAxis(config.both, 'b', config)).toBe(config.a)
  })

  it('dołożenie brakującej strony wraca do „oba"', () => {
    expect(togglePairAxis(config.a, 'b', config)).toBe(config.both)
    expect(togglePairAxis(config.b, 'a', config)).toBe(config.both)
  })

  it('odznaczenie jedynej zaznaczonej strony to no-op (min-1)', () => {
    expect(togglePairAxis(config.a, 'a', config)).toBe(config.a)
    expect(togglePairAxis(config.b, 'b', config)).toBe(config.b)
  })

  it('round-trip: oba → odznacz a → a → zaznacz a → oba', () => {
    const narrowed = togglePairAxis(config.both, 'a', config)
    expect(narrowed).toBe(config.b)
    expect(togglePairAxis(narrowed, 'a', config)).toBe(config.both)
  })
})
