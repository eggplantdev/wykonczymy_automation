import { describe, expect, it } from 'vitest'
import { computeDoZaplatyRM, computePodsumowanie } from '@/lib/kosztorys/summary-economics'

describe('computePodsumowanie', () => {
  it('Robocizna + Materiały = Łącznie (netto and brutto)', () => {
    const p = computePodsumowanie(1000, 400, 0.23)
    // Materiały enters only via Łącznie now; recover it as the complement of Robocizna.
    expect(p.lacznie.net - p.robocizna.net).toBe(400)
    expect(p.lacznie.net).toBe(1400)
    expect(p.lacznie.gross).toBeCloseTo(1400 * 1.23)
  })

  it('udziały sum to 1 (100%)', () => {
    const p = computePodsumowanie(1000, 400, 0.23)
    // Materiały udział = 1 − Robocizna udział, so the two rows sum to Łącznie's 100%.
    expect(p.lacznie.share).toBe(1)
    expect(p.robocizna.share).toBeCloseTo(1000 / 1400)
    expect(1 - p.robocizna.share).toBeCloseTo(400 / 1400)
  })

  it('zero Łącznie yields 0 shares, no division by zero', () => {
    const p = computePodsumowanie(0, 0, 0.23)
    expect(p.robocizna.share).toBe(0)
    expect(p.lacznie.share).toBe(0)
    expect(p.lacznie.net).toBe(0)
  })

  it('materiały-only: robocizna share 0, materiały (= Łącznie) share 1', () => {
    const p = computePodsumowanie(0, 500, 0.08)
    expect(p.robocizna.share).toBe(0)
    expect(p.lacznie.share).toBe(1)
    expect(p.lacznie.gross).toBeCloseTo(500 * 1.08)
  })
})

describe('computeDoZaplatyRM', () => {
  it('robocizna − zaliczki + materiały (netto and brutto)', () => {
    const r = computeDoZaplatyRM(1000, 300, 400, 0.23)
    expect(r.net).toBe(1100)
    expect(r.gross).toBeCloseTo(1100 * 1.23)
  })

  it('zero zaliczki: equals Łącznie (robocizna + materiały)', () => {
    const r = computeDoZaplatyRM(1000, 0, 400, 0.23)
    expect(r.net).toBe(1400)
  })

  it('zaliczki exceeding robocizna nets below materiały (can reach or pass zero)', () => {
    const r = computeDoZaplatyRM(1000, 1500, 500, 0.23)
    expect(r.net).toBe(0)
  })

  it('zaliczki exceeding robocizna + materiały goes negative (overpaid)', () => {
    const r = computeDoZaplatyRM(1000, 1800, 500, 0.23)
    expect(r.net).toBe(-300)
    expect(r.gross).toBeCloseTo(-300 * 1.23)
  })
})
