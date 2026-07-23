import { describe, expect, it } from 'vitest'
import {
  bucketDepositsByPlane,
  computeCashSettlement,
  computeDoZaplatyRM,
  computeSummarySplit,
  faceValue,
  grossPair,
  materialyPair,
  moneyPair,
  summaryLine,
  summaryLineFace,
  summaryLineGross,
} from '@/lib/kosztorys/summary-economics'
import type { DepositTransactionRowT } from '@/types/reference-data'

const deposit = (amount: number, vatPlane: DepositTransactionRowT['vatPlane']) => ({
  amount,
  vatPlane,
})

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

describe('moneyPair / faceValue (VAT direction primitives)', () => {
  it('moneyPair grosses a netto-native figure UP (robocizna / prace)', () => {
    const p = moneyPair(100, 0.23)
    expect(p.net).toBe(100)
    expect(p.gross).toBeCloseTo(123)
  })

  it('faceValue is a no-VAT figure: brutto === netto (wpłaty / korekta)', () => {
    const p = faceValue(300)
    expect(p.net).toBe(300)
    expect(p.gross).toBe(300)
  })

  it('moneyPair and grossPair are inverse directions at the same rate', () => {
    // 100 netto → 123 brutto → back to 100 netto.
    expect(grossPair(moneyPair(100, 0.23).gross, 0.23).net).toBeCloseTo(100)
  })
})

describe('summary-row udział builders', () => {
  it('summaryLine: netto-native row, udział = net / Łącznie', () => {
    const line = summaryLine(250, 1000, 0.23)
    expect(line.net).toBe(250)
    expect(line.gross).toBeCloseTo(307.5) // 250 × 1.23
    expect(line.share).toBeCloseTo(0.25)
  })

  it('summaryLineFace: no-VAT row (brutto === netto) still takes an udział', () => {
    const line = summaryLineFace(200, 1000)
    expect(line.net).toBe(200)
    expect(line.gross).toBe(200)
    expect(line.share).toBeCloseTo(0.2)
  })

  it('summaryLineGross: brutto-native row, udział off the DERIVED netto', () => {
    // 123 brutto → 100 netto at 23%; udział is 100/1000, not 123/1000.
    const line = summaryLineGross(123, 1000, 0.23)
    expect(line.net).toBeCloseTo(100)
    expect(line.gross).toBe(123)
    expect(line.share).toBeCloseTo(0.1)
  })

  it('zero Łącznie yields share 0 in every builder (no division by zero)', () => {
    expect(summaryLine(250, 0, 0.23).share).toBe(0)
    expect(summaryLineFace(200, 0).share).toBe(0)
    expect(summaryLineGross(123, 0, 0.23).share).toBe(0)
  })
})

describe('materialyPair (netto pricing switch)', () => {
  it('deriveNet=true removes VAT (netto = brutto ÷ 1+VAT), brutto native', () => {
    const p = materialyPair(123, 0.23, true)
    expect(p.net).toBeCloseTo(100)
    expect(p.gross).toBe(123)
  })

  it('deriveNet=false keeps the raw brutto on both axes (no reduction)', () => {
    const p = materialyPair(123, 0.23, false)
    expect(p.net).toBe(123)
    expect(p.gross).toBe(123)
  })
})

describe('materiały netto pricing off (deriveMaterialsNet=false)', () => {
  it('computeSummarySplit: materiały netto === brutto, so Łącznie netto keeps the full brutto', () => {
    const p = computeSummarySplit(1000, 123, 0.23, false)
    // Materiały netto = Łącznie netto − robocizna netto = 123 (not the VAT-stripped 100).
    expect(p.combined.net - p.laborCosts.net).toBeCloseTo(123)
    expect(p.combined.net).toBeCloseTo(1123)
    // Brutto is unchanged by the switch: robocizna 1230 + materiały 123.
    expect(p.combined.gross).toBeCloseTo(1230 + 123)
  })

  it('computeDoZaplatyRM: materiały enter netto at full brutto; brutto axis unchanged', () => {
    const r = computeDoZaplatyRM(1000, 300, 123, 0.23, false)
    // netto: robocizna 1000 − wpłaty 300 + materiały 123 (raw brutto, not derived 100).
    expect(r.net).toBeCloseTo(823)
    expect(r.gross).toBeCloseTo(1230 - 300 + 123)
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

// Explicit cash-vs-invoice waterfall anchored on Łącznie netto: − gotówka → Pozostałe netto → + VAT
// → Pozostałe z VAT → − wpłaty → Do zapłaty fakturą → + gotówka → Razem. wpłaty are subtracted AFTER
// grossing (never grossed), so C = 0 still lands on the Brutto axis „Do zapłaty".
describe('computeCashSettlement (tryb mieszany)', () => {
  const vat = 0.23
  const combinedNet = 1000 // Łącznie netto
  const wplaty = 300

  it('C = 0: total = combinedGross − wpłaty (the Brutto axis „Do zapłaty")', () => {
    const s = computeCashSettlement(combinedNet, wplaty, 0, vat)
    expect(s.cash).toBe(0)
    expect(s.remainderNet).toBeCloseTo(1000)
    expect(s.remainderGross).toBeCloseTo(1230)
    expect(s.invoice).toBeCloseTo(1230 - 300)
    expect(s.total).toBeCloseTo(1230 - 300)
  })

  it('waterfall reconstructs row by row', () => {
    const s = computeCashSettlement(combinedNet, wplaty, 400, vat)
    expect(s.remainderNet).toBeCloseTo(600) // 1000 − 400
    expect(s.remainderGross).toBeCloseTo(600 * 1.23) // + VAT
    expect(s.invoice).toBeCloseTo(600 * 1.23 - 300) // − wpłaty
    expect(s.total).toBeCloseTo(400 + (600 * 1.23 - 300)) // + gotówka
  })

  it('each cash złoty removes its own VAT: total = (combinedGross − wpłaty) − C·VAT', () => {
    const s = computeCashSettlement(combinedNet, wplaty, 400, vat)
    expect(s.total).toBeCloseTo(1230 - 300 - 400 * vat)
  })

  it('over-typing C past the base keeps going (no clamp) — remainder goes negative', () => {
    const s = computeCashSettlement(combinedNet, wplaty, 1500, vat)
    expect(s.remainderNet).toBeCloseTo(-500)
    expect(s.total).toBeCloseTo(1230 - 300 - 1500 * vat)
  })

  it('vatRate = 0: no VAT to save — total = combinedNet − wpłaty regardless of C', () => {
    const s = computeCashSettlement(1000, 300, 400, 0)
    expect(s.total).toBeCloseTo(700)
  })
})

// The netto/gross split of wpłaty that feeds the mixed-settlement gotówka target. The load-bearing
// rule is the owner's „brak wartości = netto": GROSS is the invoiced part, everything else (NET + null) is netto.
describe('bucketDepositsByPlane', () => {
  it('NET deposits bucket to paidNet, GROSS to paidGross', () => {
    const b = bucketDepositsByPlane([deposit(100, 'NET'), deposit(250, 'GROSS')])
    expect(b.paidNet).toBe(100)
    expect(b.paidGross).toBe(250)
  })

  it('a null (unmarked) deposit counts as NETTO, not brutto', () => {
    const b = bucketDepositsByPlane([deposit(100, 'GROSS'), deposit(400, null)])
    expect(b.paidNet).toBe(400)
    expect(b.paidGross).toBe(100)
  })

  it('all three states together: NET + null → paidNet, GROSS → paidGross', () => {
    const b = bucketDepositsByPlane([deposit(100, 'NET'), deposit(200, 'GROSS'), deposit(50, null)])
    expect(b.paidNet).toBe(150)
    expect(b.paidGross).toBe(200)
    // The two buckets always sum to the total wpłaty.
    expect(b.paidNet + b.paidGross).toBe(350)
  })

  it('empty list yields zeroed buckets', () => {
    const b = bucketDepositsByPlane([])
    expect(b).toEqual({ paidNet: 0, paidGross: 0 })
  })
})
