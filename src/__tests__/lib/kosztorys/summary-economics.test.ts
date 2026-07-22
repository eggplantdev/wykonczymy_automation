import { describe, expect, it } from 'vitest'
import {
  computeDoZaplatyRM,
  computeSummarySplit,
  faceValue,
  grossPair,
  moneyPair,
} from '@/lib/kosztorys/summary-economics'

describe('grossPair', () => {
  it('removes VAT to derive netto from a brutto figure (inverse of moneyPair)', () => {
    const p = grossPair(123, 0.23)
    expect(p.net).toBeCloseTo(100)
    expect(p.gross).toBe(123)
  })

  it('vat = 0 degenerates to netto === brutto', () => {
    const p = grossPair(500, 0)
    expect(p.net).toBe(500)
    expect(p.gross).toBe(500)
  })
})

describe('computeSummarySplit', () => {
  it('materiały enters as BRUTTO — its netto is derived by removing VAT', () => {
    // materiały 123 brutto → 100 netto at 23%.
    const p = computeSummarySplit(1000, 123, 0.23)
    // Materiały netto = Łącznie netto − robocizna netto.
    expect(p.combined.net - p.laborCosts.net).toBeCloseTo(100)
    expect(p.combined.net).toBeCloseTo(1100)
    // Robocizna is netto native (1000 → 1230); materiały is brutto native (123). Łącznie brutto sums
    // each side at its own native amount: 1230 + 123, NOT 1100 × 1.23.
    expect(p.laborCosts.gross).toBeCloseTo(1230)
    expect(p.combined.gross).toBeCloseTo(1230 + 123)
  })

  it('udziały sum to 1 (100%), materiały off the DERIVED netto', () => {
    const p = computeSummarySplit(1000, 123, 0.23)
    expect(p.combined.share).toBe(1)
    expect(p.laborCosts.share).toBeCloseTo(1000 / 1100)
    expect(1 - p.laborCosts.share).toBeCloseTo(100 / 1100)
  })

  it('zero Łącznie yields 0 shares, no division by zero', () => {
    const p = computeSummarySplit(0, 0, 0.23)
    expect(p.laborCosts.share).toBe(0)
    expect(p.combined.share).toBe(0)
    expect(p.combined.net).toBe(0)
  })

  it('vat = 0: materiały netto === brutto, Łącznie brutto === netto', () => {
    const p = computeSummarySplit(0, 500, 0)
    expect(p.laborCosts.share).toBe(0)
    expect(p.combined.share).toBe(1)
    expect(p.combined.net).toBe(500)
    expect(p.combined.gross).toBe(500)
  })
})

describe('computeDoZaplatyRM', () => {
  it('materiały added at derived netto (net) and raw brutto (gross); wpłaty at face value', () => {
    const r = computeDoZaplatyRM(1000, 300, 123, 0.23)
    // netto: robocizna 1000 − wpłaty 300 + materiały 100 (derived).
    expect(r.net).toBeCloseTo(800)
    // brutto: robocizna 1000 → 1230, − wpłaty 300 + materiały 123 (raw brutto).
    expect(r.gross).toBeCloseTo(1230 - 300 + 123)
  })

  it('zero zaliczki: equals Łącznie (robocizna + materiały netto)', () => {
    const r = computeDoZaplatyRM(1000, 0, 123, 0.23)
    expect(r.net).toBeCloseTo(1100)
  })

  it('zaliczki exceeding R + M goes negative (overpaid)', () => {
    const r = computeDoZaplatyRM(1000, 1800, 123, 0.23)
    expect(r.net).toBeCloseTo(1000 - 1800 + 100)
    expect(r.gross).toBeCloseTo(1230 - 1800 + 123)
  })
})

// Rabat is an obniżka OF prace, so it grosses like prace. This guards the Podsumowanie brutto
// waterfall: the display composes Łącznie − Rabat − Wpłaty and it MUST land on Do zapłaty on the
// brutto axis too, not just netto — now with materiały entering as brutto (netto derived).
describe('Podsumowanie brutto waterfall (rabat grosses, materiały brutto)', () => {
  it('Łącznie − Rabat − Wpłaty === Do zapłaty on BOTH axes', () => {
    const laborCostsNetFromKosztorys = 800 // do zapłaty, po rabacie
    const rabatNet = 200
    const materialsGross = 123 // → 100 netto at 23%
    const wplatyNet = 300
    const vat = 0.23

    const sumaPracNet = laborCostsNetFromKosztorys + rabatNet // 1000, pre-rabat
    const { combined } = computeSummarySplit(sumaPracNet, materialsGross, vat)
    const rabat = moneyPair(rabatNet, vat)
    const wplaty = faceValue(wplatyNet)
    const doZaplaty = computeDoZaplatyRM(laborCostsNetFromKosztorys, wplatyNet, materialsGross, vat)

    expect(combined.net - rabat.net - wplaty.net).toBeCloseTo(doZaplaty.net)
    expect(combined.gross - rabat.gross - wplaty.gross).toBeCloseTo(doZaplaty.gross)
    // Concretely on the brutto axis: Łącznie (1000→1230 + 123) − rabat (200→246) − wpłaty 300.
    expect(doZaplaty.gross).toBeCloseTo(1230 + 123 - 246 - 300)
  })
})
