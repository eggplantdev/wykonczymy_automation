import { describe, expect, it } from 'vitest'
import { appendRoundBlock, assertRoundDraft, hasRoundBlock } from '@/lib/kosztorys/ai-round'

describe('appendRoundBlock', () => {
  it('starts an empty field with the block alone', () => {
    expect(appendRoundBlock(null, 'Runda 2 — a')).toBe('Runda 2 — a')
    expect(appendRoundBlock('  ', 'Runda 2 — a')).toBe('Runda 2 — a')
  })

  it('keeps every earlier block and adds the new one after a blank line', () => {
    expect(appendRoundBlock('Runda 2 — a', 'Runda 3 — b')).toBe('Runda 2 — a\n\nRunda 3 — b')
  })
})

describe('assertRoundDraft', () => {
  const row = (newInformation?: string, qty: number = 2.8) => ({
    section: 'Łazienka',
    description: 'x',
    qty,
    newInformation,
  })

  it('accepts rows whose block names this round', () => {
    expect(() => assertRoundDraft([row('Runda 2 — projekt podaje 2,8 m')], 2)).not.toThrow()
  })

  it.each([undefined, '', 'Runda 3 — y', 'projekt podaje'])('refuses a row with %j', (text) => {
    expect(() => assertRoundDraft([row(text)], 2)).toThrow(/Łazienka \| x/)
  })

  it.each([undefined, Number.NaN])('refuses a row whose qty is %j', (qty) => {
    const draft = [{ ...row('Runda 2 — a'), qty: qty as number }]
    expect(() => assertRoundDraft(draft, 2)).toThrow(/Łazienka \| x/)
  })

  it('refuses round 1, which is the first draft, not a round', () => {
    expect(() => assertRoundDraft([row('Runda 1 — a')], 1)).toThrow()
  })
})

describe('hasRoundBlock', () => {
  it('finds the round on any line of the field', () => {
    expect(hasRoundBlock('Runda 2 — a\n\nRunda 3 — b', 3)).toBe(true)
    expect(hasRoundBlock('Runda 2 — a', 3)).toBe(false)
    expect(hasRoundBlock(null, 2)).toBe(false)
  })

  it('does not take „Runda 12” for „Runda 1”', () => {
    expect(hasRoundBlock('Runda 12 — a', 1)).toBe(false)
  })
})
