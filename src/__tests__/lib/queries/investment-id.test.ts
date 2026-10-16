import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ notFound: vi.fn() }))

const { isInvestmentId } = await import('@/lib/queries/investment-id')

describe('isInvestmentId — the cases the re-inlined /^\\d+$/ got wrong', () => {
  it('accepts a zero-padded id (the regex accepted it too, but Number() is what the query uses)', () => {
    expect(isInvestmentId('07')).toBe(true)
  })

  it('rejects "0" — there is no investment 0, and the regex let it through', () => {
    expect(isInvestmentId('0')).toBe(false)
  })
})

describe('isInvestmentId', () => {
  it.each(['1', '42', '999999'])('accepts %s', (id) => {
    expect(isInvestmentId(id)).toBe(true)
  })

  it.each(['', '  ', 'abc', '1a', '-1', '1.5e400', 'NaN', 'Infinity'])('rejects %j', (id) => {
    expect(isInvestmentId(id)).toBe(false)
  })
})
