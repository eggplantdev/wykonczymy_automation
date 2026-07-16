import { describe, expect, it } from 'vitest'
import {
  derivePairChecks,
  togglePairAxis,
  type PairAxisConfigT,
} from '@/lib/kosztorys/axis-checkboxes'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import type { LayerT } from '@/lib/kosztorys/layer'

const MONEY: PairAxisConfigT<MoneyAxisT> = { a: 'net', b: 'gross', both: 'both', none: 'none' }
const LAYER: PairAxisConfigT<LayerT> = { a: 'work', b: 'progress', both: 'both', none: 'none' }

// One suite per config: the mapper is generic, but both real call sites must round-trip.
describe.each([
  { name: 'oś kwot (netto/brutto)', config: MONEY },
  { name: 'oś warstw (praca/postęp)', config: LAYER },
])('derivePairChecks + togglePairAxis — $name', ({ config }) => {
  it('derivePairChecks mapuje cztery wartości na pary boolean', () => {
    expect(derivePairChecks(config.both, config)).toEqual({ a: true, b: true })
    expect(derivePairChecks(config.a, config)).toEqual({ a: true, b: false })
    expect(derivePairChecks(config.b, config)).toEqual({ a: false, b: true })
    expect(derivePairChecks(config.none, config)).toEqual({ a: false, b: false })
  })

  it('odznaczenie jednej strony z „oba" zawęża do drugiej', () => {
    expect(togglePairAxis(config.both, 'a', config)).toBe(config.b)
    expect(togglePairAxis(config.both, 'b', config)).toBe(config.a)
  })

  it('dołożenie brakującej strony wraca do „oba"', () => {
    expect(togglePairAxis(config.a, 'b', config)).toBe(config.both)
    expect(togglePairAxis(config.b, 'a', config)).toBe(config.both)
  })

  it('odznaczenie jedynej zaznaczonej strony schodzi do „none" (bez blokady)', () => {
    expect(togglePairAxis(config.a, 'a', config)).toBe(config.none)
    expect(togglePairAxis(config.b, 'b', config)).toBe(config.none)
  })

  it('zaznaczenie strony z „none" włącza tylko tę stronę', () => {
    expect(togglePairAxis(config.none, 'a', config)).toBe(config.a)
    expect(togglePairAxis(config.none, 'b', config)).toBe(config.b)
  })

  it('round-trip: oba → odznacz a → b → odznacz b → none → zaznacz a → a', () => {
    const narrowed = togglePairAxis(config.both, 'a', config)
    expect(narrowed).toBe(config.b)
    const emptied = togglePairAxis(narrowed, 'b', config)
    expect(emptied).toBe(config.none)
    expect(togglePairAxis(emptied, 'a', config)).toBe(config.a)
  })
})
