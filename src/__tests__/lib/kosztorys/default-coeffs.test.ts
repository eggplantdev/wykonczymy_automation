import { describe, expect, it } from 'vitest'
import { DEFAULT_COEFFS } from '@/lib/kosztorys/constants'

// „Bez narzędzi" is not a second decision — the sheet writes it as `=R−R*0,15`, so it moves whenever
// the w-tools rate does.
describe('DEFAULT_COEFFS', () => {
  it('derives the own-tools rate from the w-tools rate, less 15%', () => {
    expect(DEFAULT_COEFFS.ownTools).toBe(DEFAULT_COEFFS.wTools * 0.85)
  })
})
