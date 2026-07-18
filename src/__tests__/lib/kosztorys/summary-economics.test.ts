import { describe, expect, it } from 'vitest'
import { computePodsumowanie } from '@/lib/kosztorys/summary-economics'

describe('computePodsumowanie', () => {
  it('Robocizna + Materiały = Łącznie (netto and brutto)', () => {
    const p = computePodsumowanie(1000, 400, 0.23)
    expect(p.robocizna.net + p.materialy.net).toBe(p.lacznie.net)
    expect(p.lacznie.net).toBe(1400)
    expect(p.robocizna.gross + p.materialy.gross).toBeCloseTo(p.lacznie.gross)
    expect(p.lacznie.gross).toBeCloseTo(1400 * 1.23)
  })

  it('udziały sum to 1 (100%)', () => {
    const p = computePodsumowanie(1000, 400, 0.23)
    expect(p.robocizna.share + p.materialy.share).toBeCloseTo(1)
    expect(p.lacznie.share).toBe(1)
    expect(p.robocizna.share).toBeCloseTo(1000 / 1400)
  })

  it('zero Łącznie yields 0 shares, no division by zero', () => {
    const p = computePodsumowanie(0, 0, 0.23)
    expect(p.robocizna.share).toBe(0)
    expect(p.materialy.share).toBe(0)
    expect(p.lacznie.share).toBe(0)
    expect(p.lacznie.net).toBe(0)
  })

  it('materiały-only: robocizna share 0, materiały share 1', () => {
    const p = computePodsumowanie(0, 500, 0.08)
    expect(p.robocizna.share).toBe(0)
    expect(p.materialy.share).toBe(1)
    expect(p.materialy.gross).toBeCloseTo(500 * 1.08)
  })
})
