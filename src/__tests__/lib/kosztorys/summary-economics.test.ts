import { describe, expect, it } from 'vitest'
import {
  computeDoZaplatyRM,
  computeSummarySplit,
  faceValue,
  moneyPair,
  reduceDepositBuckets,
  type DepositBucketsT,
} from '@/lib/kosztorys/summary-economics'
import type { DepositRowT } from '@/types/reference-data'

// No-deposit baseline; individual tests override the buckets they exercise.
const NO_DEPOSITS: DepositBucketsT = { sumNet: 0, sumGross: 0, legacySum: 0 }
// A legacy-only bucket reproduces the pre-flag `R − wplaty` behaviour on both axes.
const legacyOnly = (amount: number): DepositBucketsT => ({
  sumNet: 0,
  sumGross: 0,
  legacySum: amount,
})

describe('computeSummarySplit', () => {
  it('Łącznie brutto grosses ONLY robocizna — materiały carries no VAT', () => {
    const p = computeSummarySplit(1000, 400, 0.23)
    // Materiały enters only via Łącznie now; recover it as the complement of Robocizna.
    expect(p.combined.net - p.laborCosts.net).toBe(400)
    expect(p.combined.net).toBe(1400)
    // VAT is prace-only: robocizna 1000 → 1230 brutto, materiały 400 at face value. NOT 1400 × 1.23.
    expect(p.laborCosts.gross).toBeCloseTo(1230)
    expect(p.combined.gross).toBeCloseTo(1230 + 400)
  })

  it('udziały sum to 1 (100%)', () => {
    const p = computeSummarySplit(1000, 400, 0.23)
    // Materiały udział = 1 − Robocizna udział, so the two rows sum to Łącznie's 100%.
    expect(p.combined.share).toBe(1)
    expect(p.laborCosts.share).toBeCloseTo(1000 / 1400)
    expect(1 - p.laborCosts.share).toBeCloseTo(400 / 1400)
  })

  it('zero Łącznie yields 0 shares, no division by zero', () => {
    const p = computeSummarySplit(0, 0, 0.23)
    expect(p.laborCosts.share).toBe(0)
    expect(p.combined.share).toBe(0)
    expect(p.combined.net).toBe(0)
  })

  it('materiały-only: robocizna share 0, materiały (= Łącznie) share 1, brutto === netto', () => {
    const p = computeSummarySplit(0, 500, 0.08)
    expect(p.laborCosts.share).toBe(0)
    expect(p.combined.share).toBe(1)
    // No prace ⇒ no VAT anywhere: Łącznie brutto equals its netto, NOT 500 × 1.08.
    expect(p.combined.gross).toBeCloseTo(500)
  })
})

describe('reduceDepositBuckets', () => {
  it('maps vatPlane NET/GROSS/NULL to sumNet/sumGross/legacySum', () => {
    const rows: DepositRowT[] = [
      { id: 1, date: '2026-07-01', amount: 100, vatPlane: 'NET' },
      { id: 2, date: '2026-07-02', amount: 200, vatPlane: 'NET' },
      { id: 3, date: '2026-07-03', amount: 300, vatPlane: 'GROSS' },
      { id: 4, date: '2026-07-04', amount: 400, vatPlane: null },
    ]
    expect(reduceDepositBuckets(rows)).toEqual({ sumNet: 300, sumGross: 300, legacySum: 400 })
  })

  it('no rows → all zero buckets', () => {
    expect(reduceDepositBuckets([])).toEqual(NO_DEPOSITS)
  })
})

describe('computeDoZaplatyRM', () => {
  // Legacy (NULL-plane) deposits subtract at face on both axes — the pre-flag behaviour: net = R −
  // wplaty + M, gross = toGross(R) − wplaty + M. These four cases treat the old `wplatyNet` as legacy.
  it('brutto grosses ONLY robocizna — legacy wpłaty and materiały enter at face value', () => {
    const r = computeDoZaplatyRM(1000, legacyOnly(300), 400, 0.23)
    expect(r.net).toBe(1100)
    // robocizna 1000 → 1230 brutto, then − legacy 300 + materiały 400, both face value. NOT 1100 × 1.23.
    expect(r.gross).toBeCloseTo(1230 - 300 + 400)
  })

  it('zero deposits: equals Łącznie (robocizna + materiały)', () => {
    const r = computeDoZaplatyRM(1000, NO_DEPOSITS, 400, 0.23)
    expect(r.net).toBe(1400)
  })

  it('legacy exceeding robocizna nets below materiały (can reach or pass zero)', () => {
    const r = computeDoZaplatyRM(1000, legacyOnly(1500), 500, 0.23)
    expect(r.net).toBe(0)
  })

  it('legacy exceeding robocizna + materiały goes negative (overpaid)', () => {
    const r = computeDoZaplatyRM(1000, legacyOnly(1800), 500, 0.23)
    expect(r.net).toBe(-300)
    // robocizna 1000 → 1230 brutto, − legacy 1800 + materiały 500 (face value) = −70. NOT −300 × 1.23.
    expect(r.gross).toBeCloseTo(1230 - 1800 + 500)
  })

  // The sequential model: a netto-flagged deposit reduces the base pre-VAT, so it shaves sumNet×VAT
  // off the brutto owed. Owner-locked example: R 2000, sumNet 1000, VAT 0.08 → net 1000, gross 1080.
  it('netto bucket reduces the base pre-VAT (owner example)', () => {
    const r = computeDoZaplatyRM(2000, { sumNet: 1000, sumGross: 0, legacySum: 0 }, 0, 0.08)
    expect(r.net).toBe(1000)
    // baseLeft = 2000 − 1000 = 1000; gross = 1000 × 1.08 = 1080. NOT 2160 − 1000.
    expect(r.gross).toBeCloseTo(1080)
  })

  // Same R/amount/VAT as legacy, so the difference is purely the plane: a legacy 1000 yields gross
  // 1160 (= toGross(2000) − 1000), which is sumNet×VAT = 80 HIGHER than the netto-bucket 1080.
  it('legacy-only matches pre-flag both axes; netto bucket is short by sumNet×VAT (by design)', () => {
    const legacy = computeDoZaplatyRM(2000, legacyOnly(1000), 0, 0.08)
    expect(legacy.net).toBe(1000)
    expect(legacy.gross).toBeCloseTo(1160)

    const netto = computeDoZaplatyRM(2000, { sumNet: 1000, sumGross: 0, legacySum: 0 }, 0, 0.08)
    expect(legacy.gross - netto.gross).toBeCloseTo(1000 * 0.08)
  })

  // A brutto-flagged deposit is already gross, so it subtracts once from the gross axis only.
  it('brutto bucket subtracts from the gross axis, leaves netto untouched', () => {
    const r = computeDoZaplatyRM(2000, { sumNet: 0, sumGross: 1080, legacySum: 0 }, 0, 0.08)
    // baseLeft = 2000 (no netto bucket); net = 2000; gross = 2160 − 1080 = 1080.
    expect(r.net).toBe(2000)
    expect(r.gross).toBeCloseTo(2160 - 1080)
  })
})

// Rabat is an obniżka OF prace, so it grosses like prace. This guards the Podsumowanie brutto
// waterfall with LEGACY-ONLY deposits: legacy subtracts at face on both axes, so the display's
// Łącznie − Rabat − Wpłaty still lands on Do zapłaty on the brutto axis (this is exactly why legacy
// is at face — it preserves the old footing). It only closes when rabat is moneyPair (grossed); the
// earlier faceValue(rabat) left it off by rabat × VAT. NB: a netto-flagged deposit would NOT foot
// here (short by sumNet×VAT) — that's the sequential model's deliberate shift, covered above.
describe('Podsumowanie brutto waterfall — legacy deposits foot on both axes (rabat grosses)', () => {
  it('Łącznie − Rabat − Wpłaty === Do zapłaty on BOTH axes (legacy)', () => {
    const laborCostsNetFromKosztorys = 800 // do zapłaty, po rabacie
    const rabatNet = 200
    const materialyNet = 400
    const legacyWplaty = 300
    const vat = 0.23

    const sumaPracNet = laborCostsNetFromKosztorys + rabatNet // 1000, pre-rabat
    const { combined } = computeSummarySplit(sumaPracNet, materialyNet, vat)
    const rabat = moneyPair(rabatNet, vat)
    const wplaty = faceValue(legacyWplaty)
    const doZaplaty = computeDoZaplatyRM(
      laborCostsNetFromKosztorys,
      legacyOnly(legacyWplaty),
      materialyNet,
      vat,
    )

    expect(combined.net - rabat.net - wplaty.net).toBeCloseTo(doZaplaty.net)
    expect(combined.gross - rabat.gross - wplaty.gross).toBeCloseTo(doZaplaty.gross)
    // Concretely on the brutto axis: Łącznie (1000→1230 + 400) − rabat (200→246) − wpłaty 300.
    expect(doZaplaty.gross).toBeCloseTo(1230 + 400 - 246 - 300)
    // The old faceValue(rabat) would have used 200 here, overstating Do zapłaty by rabat × VAT (46).
    expect(combined.gross - rabatNet - wplaty.gross).not.toBeCloseTo(doZaplaty.gross)
  })
})
