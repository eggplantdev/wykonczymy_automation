import { describe, expect, it } from 'vitest'
import {
  computeDoZaplatyRM,
  computePodsumowanie,
  faceValue,
  moneyPair,
} from '@/lib/kosztorys/summary-economics'

describe('computePodsumowanie', () => {
  it('Łącznie brutto grosses ONLY robocizna — materiały carries no VAT', () => {
    const p = computePodsumowanie(1000, 400, 0.23)
    // Materiały enters only via Łącznie now; recover it as the complement of Robocizna.
    expect(p.lacznie.net - p.robocizna.net).toBe(400)
    expect(p.lacznie.net).toBe(1400)
    // VAT is prace-only: robocizna 1000 → 1230 brutto, materiały 400 at face value. NOT 1400 × 1.23.
    expect(p.robocizna.gross).toBeCloseTo(1230)
    expect(p.lacznie.gross).toBeCloseTo(1230 + 400)
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

  it('materiały-only: robocizna share 0, materiały (= Łącznie) share 1, brutto === netto', () => {
    const p = computePodsumowanie(0, 500, 0.08)
    expect(p.robocizna.share).toBe(0)
    expect(p.lacznie.share).toBe(1)
    // No prace ⇒ no VAT anywhere: Łącznie brutto equals its netto, NOT 500 × 1.08.
    expect(p.lacznie.gross).toBeCloseTo(500)
  })
})

describe('computeDoZaplatyRM', () => {
  it('brutto grosses ONLY robocizna — wpłaty and materiały enter at face value', () => {
    const r = computeDoZaplatyRM(1000, 300, 400, 0.23)
    expect(r.net).toBe(1100)
    // robocizna 1000 → 1230 brutto, then − wpłaty 300 + materiały 400, both face value. NOT 1100 × 1.23.
    expect(r.gross).toBeCloseTo(1230 - 300 + 400)
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
    // robocizna 1000 → 1230 brutto, − wpłaty 1800 + materiały 500 (face value) = −70. NOT −300 × 1.23.
    expect(r.gross).toBeCloseTo(1230 - 1800 + 500)
  })
})

// Rabat is an obniżka OF prace, so it grosses like prace. This guards the Podsumowanie brutto
// waterfall: the display composes Łącznie − Rabat − Wpłaty and it MUST land on Do zapłaty on the
// brutto axis too, not just netto. It only closes when rabat is moneyPair (grossed); the earlier
// faceValue(rabat) left it off by rabat × VAT.
describe('Podsumowanie brutto waterfall (rabat grosses)', () => {
  it('Łącznie − Rabat − Wpłaty === Do zapłaty on BOTH axes', () => {
    const robociznaNet = 800 // do zapłaty, po rabacie
    const rabatNet = 200
    const materialyNet = 400
    const wplatyNet = 300
    const vat = 0.23

    const sumaPracNet = robociznaNet + rabatNet // 1000, pre-rabat
    const { lacznie } = computePodsumowanie(sumaPracNet, materialyNet, vat)
    const rabat = moneyPair(rabatNet, vat)
    const wplaty = faceValue(wplatyNet)
    const doZaplaty = computeDoZaplatyRM(robociznaNet, wplatyNet, materialyNet, vat)

    expect(lacznie.net - rabat.net - wplaty.net).toBeCloseTo(doZaplaty.net)
    expect(lacznie.gross - rabat.gross - wplaty.gross).toBeCloseTo(doZaplaty.gross)
    // Concretely on the brutto axis: Łącznie (1000→1230 + 400) − rabat (200→246) − wpłaty 300.
    expect(doZaplaty.gross).toBeCloseTo(1230 + 400 - 246 - 300)
    // The old faceValue(rabat) would have used 200 here, overstating Do zapłaty by rabat × VAT (46).
    expect(lacznie.gross - rabatNet - wplaty.gross).not.toBeCloseTo(doZaplaty.gross)
  })
})
