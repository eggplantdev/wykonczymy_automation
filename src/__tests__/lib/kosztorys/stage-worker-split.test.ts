import { describe, expect, it } from 'vitest'
import {
  normalizeStageSplit,
  splitStagePool,
  validateStageSplit,
} from '@/lib/kosztorys/stage-worker-split'
import type { StageMemberT, StageSplitT } from '@/lib/kosztorys/types'

const entered = (workerId: number, value: number): StageMemberT => ({
  workerId,
  value,
  takesRest: false,
})
const rest = (workerId: number): StageMemberT => ({ workerId, value: 0, takesRest: true })

const percent = (...members: StageMemberT[]): StageSplitT => ({ mode: 'percent', members })
const amount = (...members: StageMemberT[]): StageSplitT => ({ mode: 'amount', members })

const sum = (shares: Map<number, number>) => [...shares.values()].reduce((a, b) => a + b, 0)

describe('splitStagePool', () => {
  it('gives the rest holder what the entered percentages leave', () => {
    const { shares, scaledDown } = splitStagePool(
      4000,
      percent(entered(1, 25), entered(2, 25), entered(3, 25), rest(4)),
    )
    expect([...shares.entries()]).toEqual([
      [1, 1000],
      [2, 1000],
      [3, 1000],
      [4, 1000],
    ])
    expect(scaledDown).toBe(false)
  })

  it('pays fixed amounts in full and the rest holder the remainder of the pool', () => {
    const { shares, scaledDown } = splitStagePool(
      4000,
      amount(entered(1, 1000), entered(2, 1000), entered(3, 1000), rest(4)),
    )
    expect(shares.get(4)).toBe(1000)
    expect(sum(shares)).toBe(4000)
    expect(scaledDown).toBe(false)
  })

  it('gives the rest holder 0 when the fixed amounts use the whole pool exactly', () => {
    const { shares, scaledDown } = splitStagePool(
      3000,
      amount(entered(1, 1000), entered(2, 1000), entered(3, 1000), rest(4)),
    )
    expect(shares.get(4)).toBe(0)
    expect(scaledDown).toBe(false)
  })

  it('shrinks fixed amounts pro rata when the pool drops below them, never below zero', () => {
    const { shares, scaledDown } = splitStagePool(
      2400,
      amount(entered(1, 1000), entered(2, 1000), entered(3, 1000), rest(4)),
    )
    expect(shares.get(1)).toBeCloseTo(800, 10)
    expect(shares.get(2)).toBeCloseTo(800, 10)
    expect(shares.get(3)).toBeCloseTo(800, 10)
    expect(shares.get(4)).toBe(0)
    expect(sum(shares)).toBeCloseTo(2400, 10)
    expect(scaledDown).toBe(true)
  })

  it('splits nothing when no work was executed', () => {
    for (const split of [percent(entered(1, 50), rest(2)), amount(entered(1, 500), rest(2))]) {
      const { shares, scaledDown } = splitStagePool(0, split)
      expect([...shares.values()]).toEqual([0, 0])
      expect(scaledDown).toBe(false)
    }
  })

  it('hands a one-person split the whole pool, bit for bit', () => {
    const pool = 1234.5678
    expect(splitStagePool(pool, percent(rest(7))).shares.get(7)).toBe(pool)
    expect(splitStagePool(pool, amount(rest(7))).shares.get(7)).toBe(pool)
  })

  it('never lets float residue turn the rest holder negative', () => {
    // 0.1 + 0.2 > 0.3 in floating point, so pool − Σ would come out at −5.5e-17.
    const { shares, scaledDown } = splitStagePool(
      0.3,
      amount(entered(1, 0.1), entered(2, 0.2), rest(3)),
    )
    expect(shares.get(3)).toBe(0)
    expect(scaledDown).toBe(false)
    for (const share of shares.values()) expect(share).toBeGreaterThanOrEqual(0)
  })

  it('keeps Σ shares equal to the pool for an uneven percent split', () => {
    const pool = 1000 / 3
    const { shares } = splitStagePool(pool, percent(entered(1, 33.33), entered(2, 12.5), rest(3)))
    expect(sum(shares)).toBeCloseTo(pool, 10)
  })
})

describe('normalizeStageSplit', () => {
  it('reads a split without members as no split at all', () => {
    expect(normalizeStageSplit(percent())).toBeNull()
    expect(normalizeStageSplit(null)).toBeNull()
  })

  it('elects the first member when nobody takes the rest', () => {
    const normalized = normalizeStageSplit(amount(entered(1, 100), entered(2, 200)))
    expect(normalized?.members).toEqual([rest(1), entered(2, 200)])
  })

  it('keeps only the first of several rest holders', () => {
    const normalized = normalizeStageSplit(percent(rest(1), rest(2)))
    expect(normalized?.members).toEqual([rest(1), entered(2, 0)])
  })

  it('zeroes the value the rest holder never uses', () => {
    const normalized = normalizeStageSplit(percent({ workerId: 1, value: 40, takesRest: true }))
    expect(normalized?.members).toEqual([rest(1)])
  })
})

describe('validateStageSplit', () => {
  it('accepts a valid split', () => {
    expect(validateStageSplit(percent(entered(1, 25), rest(2)), 0)).toBeNull()
    expect(validateStageSplit(amount(entered(1, 1000), rest(2)), 1000)).toBeNull()
  })

  it('refuses a split nobody takes the rest of, or two people do', () => {
    expect(validateStageSplit(percent(entered(1, 25), entered(2, 25)), 100)).not.toBeNull()
    expect(validateStageSplit(percent(rest(1), rest(2)), 100)).not.toBeNull()
  })

  it('refuses an empty split', () => {
    expect(validateStageSplit(percent(), 100)).not.toBeNull()
  })

  it('refuses the same worker twice', () => {
    expect(validateStageSplit(percent(entered(1, 10), rest(1)), 100)).not.toBeNull()
  })

  it('refuses a value that is not a number', () => {
    expect(validateStageSplit(percent(entered(1, Number.NaN), rest(2)), 100)).not.toBeNull()
  })

  it('refuses a negative value', () => {
    expect(validateStageSplit(amount(entered(1, -1), rest(2)), 100)).not.toBeNull()
  })

  it('refuses percentages above 100', () => {
    expect(validateStageSplit(percent(entered(1, 60), entered(2, 41), rest(3)), 100)).not.toBeNull()
    expect(validateStageSplit(percent(entered(1, 60), entered(2, 40), rest(3)), 100)).toBeNull()
  })

  it('refuses fixed amounts above the executed-work value', () => {
    const split = amount(entered(1, 1000), entered(2, 1000), entered(3, 1000), rest(4))
    expect(validateStageSplit(split, 2000)).toMatch(/2\s?000,00/)
    expect(validateStageSplit(split, 3000)).toBeNull()
  })

  it('accepts only zero amounts while nothing has been executed', () => {
    expect(validateStageSplit(amount(entered(1, 0), rest(2)), 0)).toBeNull()
    expect(validateStageSplit(amount(entered(1, 1), rest(2)), 0)).not.toBeNull()
  })

  it('compares the amount cap to the grosz, not to float noise', () => {
    expect(validateStageSplit(amount(entered(1, 0.1), entered(2, 0.2), rest(3)), 0.3)).toBeNull()
  })
})
