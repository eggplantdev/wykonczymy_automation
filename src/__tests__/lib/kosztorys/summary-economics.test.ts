import { describe, expect, it } from 'vitest'
import {
  breakdownRowPair,
  combinedPair,
  computeAmountDue,
  faceValue,
  materialsNetDiscount,
  billedMaterials,
  billedMaterialsPair,
  moneyPair,
  laborCostsNetPreDiscount,
} from '@/lib/kosztorys/summary-economics'
import { clientTotalsFromSubtotals } from '@/lib/kosztorys/settlement-client-totals'
import type { SectionSubtotalT } from '@/lib/kosztorys/types'

// Materiały with nothing billed netto — the pre-netto-type world, so the existing expectations
// keep reading as the brutto-only baseline they were written for.
const justGross = (grossBase: number) => ({ grossBase, netBilled: 0 })

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

  it('moneyPair and billedMaterialsPair are inverse directions at the same rate', () => {
    // 100 netto → 123 brutto → back to 100 netto.
    expect(billedMaterialsPair(moneyPair(100, 0.23).gross, 0.23).net).toBeCloseTo(100)
  })
})

describe('billedMaterialsPair (netto pricing switch)', () => {
  // 123 brutto at a 23% rate is billed 100 netto — the price whose gross-up returns the receipt.
  // `123 × (1 − 0,23) = 94,71` is a different, larger concession than the server computes, so this
  // pins the division against a re-derivation of the old subtraction.
  it('a rate divides brutto down to the netto price, brutto native', () => {
    const p = billedMaterialsPair(123, 0.23)
    expect(p.net).toBeCloseTo(100)
    expect(p.net).not.toBeCloseTo(123 * (1 - 0.23))
    expect(p.gross).toBe(123)
  })

  it('no rate keeps the raw brutto on both axes — where every investment starts', () => {
    const p = billedMaterialsPair(123, null)
    expect(p.net).toBe(123)
    expect(p.gross).toBe(123)
  })
})

// A brutto row crosses to netto through the rate; a netto row crosses nothing — both of its amounts
// are on the invoice (owner, 2026-09-23). The invoice pair below is 8% apart and the rates are 12%
// and 23%, so a brutto derived from the rate can never coincide with the recorded one.
const INVOICE = { net: 4453.33, gross: 4809.6 }
const netRow = (net: number, recordedGross: number) => ({
  net,
  origin: 'netBilled' as const,
  recordedGross,
})

describe('breakdownRowPair (one „Wydatki inwestycyjne" row on both planes)', () => {
  it('a brutto row keeps its receipt and divides down to netto', () => {
    const p = breakdownRowPair({ net: 123, origin: 'gross' }, 0.23)
    expect(p.gross).toBe(123)
    expect(p.net).toBeCloseTo(100)
  })

  it.each([0.12, 0.23])('a netto row shows the invoice on both planes at a %s rate', (rate) => {
    expect(breakdownRowPair(netRow(INVOICE.net, INVOICE.gross), rate)).toEqual(INVOICE)
  })

  // Owner Q1: with no rate the table has one „Kwota" column, and it shows what the investor is
  // billed — the netto — so Razem still equals „Materiały" in the podsumowanie.
  it('no rate = one figure per row, the billed one', () => {
    expect(breakdownRowPair(netRow(INVOICE.net, INVOICE.gross), null)).toEqual(
      faceValue(INVOICE.net),
    )
    expect(breakdownRowPair({ net: 123, origin: 'gross' }, null)).toEqual({ net: 123, gross: 123 })
  })

  // „Korekta (bez kategorii)" arrives negative. The bug this replaced flipped or flattened such a
  // row, so pin both the sign and the ratio: a credit must cross the bridge exactly like a charge.
  it('a negative row keeps its sign — a brutto one its ratio, a netto one its invoice', () => {
    const gross = breakdownRowPair({ net: -123, origin: 'gross' }, 0.23)
    expect(gross.gross).toBe(-123)
    expect(gross.net).toBeCloseTo(-100)

    expect(breakdownRowPair(netRow(-100, -108), 0.23)).toEqual({ net: -100, gross: -108 })
  })
})

// The settlement steps carry one money column, so materiały must reduce to ONE figure: the plane the
// investor is actually billed on.
describe('billedMaterials', () => {
  it('a saved rate bills the netto price, not the receipt', () => {
    expect(billedMaterials({ grossBase: 123, netBilled: 0 }, 0.23)).toBeCloseTo(100)
  })

  it('the netto-billed bucket enters at face value, never cut a second time', () => {
    expect(billedMaterials({ grossBase: 123, netBilled: 1234.56 }, 0.23)).toBeCloseTo(1334.56)
  })

  it('no rate bills the raw receipt plus the netto bucket', () => {
    expect(billedMaterials({ grossBase: 123, netBilled: 10 }, null)).toBe(133)
    expect(billedMaterials({ grossBase: 12_300, netBilled: 1000 }, null)).toBe(13_300)
  })
})

describe('materialsNetDiscount', () => {
  it('is what billing netto gives away — 23 zł on a 123 zł receipt at 23%', () => {
    expect(materialsNetDiscount(123, 0.23)).toBeCloseTo(23)
  })

  it('is 0 without a rate', () => {
    expect(materialsNetDiscount(123, null)).toBe(0)
  })
})

describe('materiały netto pricing off (no saved rate)', () => {
  it('combinedPair: materiały netto === brutto, so Łącznie carries the full receipt on both axes', () => {
    const combined = combinedPair(1000, faceValue(billedMaterials(justGross(123), null)), 0.23)
    expect(combined.net).toBeCloseTo(1123)
    expect(combined.gross).toBeCloseTo(1230 + 123)
  })

  it('computeAmountDue: materiały enter netto at full brutto; brutto axis unchanged', () => {
    const r = computeAmountDue(1000, { net: 300, gross: 300 }, justGross(123), 0.23, null)
    // netto: robocizna 1000 − wpłaty 300 + materiały 123 (raw brutto, not derived 100).
    expect(r.net).toBeCloseTo(823)
    expect(r.gross).toBeCloseTo(1230 - 300 + 123)
  })
})

// „Łącznie" = prace on their two planes + materiały as ONE billed figure. Materiały enters both
// axes at the same złoty because the panel prints it as a single merged cell — a total the reader
// cannot re-add from the cell above it is the defect this pins.
describe('combinedPair („Łącznie")', () => {
  it('prace gross, materiały enter both axes at the billed figure', () => {
    // materiały 123 brutto → billed 100 netto at a 23% rate.
    const combined = combinedPair(1000, faceValue(billedMaterials(justGross(123), 0.23)), 0.23)
    expect(combined.net).toBeCloseTo(1100)
    // 1230 + 100 — the SAME 100 the netto axis added, not the raw 123 receipt.
    expect(combined.gross).toBeCloseTo(1330)
  })

  it('the two axes differ by exactly the VAT on prace, never on materiały', () => {
    const combined = combinedPair(1000, faceValue(100), 0.23)
    expect(combined.gross - combined.net).toBeCloseTo(230)
  })

  it('vat = 0: both axes read the same figure', () => {
    expect(combinedPair(0, faceValue(500), 0)).toEqual({ net: 500, gross: 500 })
  })
})

// `paid` arrives as a pair the wpłaty already carry — a gotówka's kwota netto, a przelew's two
// kwoty off its faktura. Nothing here derives one plane from the other; that division is what the
// three bugs below were made of.
describe('computeAmountDue', () => {
  const NO_MATERIALS = { grossBase: 0, netBilled: 0 }

  it('materiały added at derived netto (net) and raw brutto (gross); wpłaty at face value', () => {
    const r = computeAmountDue(1000, { net: 300, gross: 300 }, justGross(123), 0.23, 0.23)
    // netto: robocizna 1000 − wpłaty 300 + materiały 100 (billed).
    expect(r.net).toBeCloseTo(800)
    // brutto: robocizna 1000 → 1230, − wpłaty 300 + the same billed 100.
    expect(r.gross).toBeCloseTo(1230 - 300 + 100)
  })

  it('zero zaliczki: equals Łącznie (robocizna + materiały netto)', () => {
    const r = computeAmountDue(1000, { net: 0, gross: 0 }, justGross(123), 0.23, 0.23)
    expect(r.net).toBeCloseTo(1100)
  })

  it('zaliczki exceeding R + M goes negative (overpaid)', () => {
    const r = computeAmountDue(1000, { net: 1800, gross: 1800 }, justGross(123), 0.23, 0.23)
    expect(r.net).toBeCloseTo(1000 - 1800 + 100)
    expect(r.gross).toBeCloseTo(1230 - 1800 + 100)
  })

  it('each plane subtracts its OWN kwota — a przelew pays 12 300 brutto and 10 000 netto', () => {
    const r = computeAmountDue(10_000, { net: 10_000, gross: 12_300 }, NO_MATERIALS, 0.23, null)
    expect(r.net).toBeCloseTo(0)
    expect(r.gross).toBeCloseTo(0)
  })

  // The owner's signed example (`change.md`): robocizna 88 500 netto, materiały 10 000 z paragonu
  // przy 8%, wpłaty 40 000 gotówką + 10 000 przelewem. Computed here by hand, not by re-running the
  // function's own arithmetic — the netto column is the one tryb mieszany renders.
  it('lands on the owner-signed 48 500,00 netto', () => {
    const VAT = 0.08
    const transferNet = 10_000 / (1 + VAT)
    const r = computeAmountDue(
      88_500,
      { net: 40_000 + transferNet, gross: 10_000 },
      { grossBase: 10_000, netBilled: 0 },
      VAT,
      VAT,
    )

    expect(r.net).toBeCloseTo(48_500, 2)
    // Materiały stand at face value on both planes, so brutto = 95 580 + 9 259,26 − 10 000.
    expect(r.gross).toBeCloseTo(94_839.26, 2)
  })

  // REGRESSION (`change.md` bug 1): a wpłata brutto used to be subtracted at face value from the
  // netto column, so 10 000 zł billed and settled by a 12 300 zł przelew read −2 399,20 owed.
  it('never lets a przelew overshoot the netto column', () => {
    const r = computeAmountDue(10_000, { net: 10_000, gross: 12_300 }, NO_MATERIALS, 0.23, null)
    expect(r.net).not.toBeCloseTo(-2300)
    expect(r.net).toBeCloseTo(0)
  })

  // REGRESSION (`change.md` bug 2): „Pozostało brutto" was Łącznie brutto − wpłaty NETTO, which
  // charged the VAT on the already-settled part — 3 200 zł on a 40 000 zł bill at 8%.
  it('charges no VAT on the part a przelew already settled', () => {
    const r = computeAmountDue(40_000, { net: 40_000, gross: 43_200 }, NO_MATERIALS, 0.08, null)
    expect(r.gross).not.toBeCloseTo(3200)
    expect(r.gross).toBeCloseTo(0)
  })
})

// A strata is a cost the company swallowed, so the client stops owing exactly the złoty entered —
// the same złoty on both axes. That is what separates it from a rabat, which is a concession ON the
// price and therefore grosses: 1000 zł of rabat wipes 1230 zł of brutto debt, 1000 zł of strata
// wipes 1000 zł. Grossing it here would hand the client 230 zł nobody ever charged.
describe('strata enters the settlement at face value', () => {
  it('computeAmountDue: one loss lowers netto and brutto by the SAME złoty', () => {
    const paid = { net: 300, gross: 300 }
    const base = computeAmountDue(1000, paid, justGross(123), 0.23, 0.23)
    const withLoss = computeAmountDue(1000, paid, justGross(123), 0.23, 0.23, 400)
    expect(base.net - withLoss.net).toBeCloseTo(400)
    expect(base.gross - withLoss.gross).toBeCloseTo(400)
  })

  it('lands exactly where an equal wpłata would, on both planes', () => {
    const asDeposit = computeAmountDue(1000, { net: 450, gross: 450 }, justGross(123), 0.23, 0.23)
    const asLoss = computeAmountDue(1000, { net: 300, gross: 300 }, justGross(123), 0.23, 0.23, 150)
    expect(asLoss.net).toBeCloseTo(asDeposit.net)
    expect(asLoss.gross).toBeCloseTo(asDeposit.gross)
  })
})

// Rabat is an obniżka OF prace, so it grosses like prace. This guards the Podsumowanie brutto
// waterfall: the display composes Łącznie − Rabat − Wpłaty and it MUST land on Do zapłaty on the
// brutto axis too, not just netto — now with materiały entering as brutto (netto derived).
describe('Podsumowanie brutto waterfall (rabat grosses, materiały brutto)', () => {
  it('Łącznie − Rabat − Wpłaty === Do zapłaty on BOTH axes', () => {
    const laborCostsNet = 800 // do zapłaty, po rabacie
    const discountNet = 200
    const materialsGross = 123 // → 100 netto at 23%
    // A przelew: 300 brutto whose faktura names 250 netto. The waterfall has to close on each
    // axis against ITS kwota — a single figure subtracted from both is bug 1 and bug 2 at once.
    const paid = { net: 250, gross: 300 }
    const vat = 0.23

    const laborCostsNetFromKosztorys = laborCostsNet + discountNet // 1000, pre-rabat
    const combined = combinedPair(
      laborCostsNetFromKosztorys,
      faceValue(billedMaterials(justGross(materialsGross), vat)),
      vat,
    )
    const discount = moneyPair(discountNet, vat)
    const amountDue = computeAmountDue(laborCostsNet, paid, justGross(materialsGross), vat, vat)

    expect(combined.net - discount.net - paid.net).toBeCloseTo(amountDue.net)
    expect(combined.gross - discount.gross - paid.gross).toBeCloseTo(amountDue.gross)
    // Concretely on the brutto axis: Łącznie (1000→1230 + 100) − rabat (200→246) − wpłaty 300.
    expect(amountDue.gross).toBeCloseTo(1230 + 100 - 246 - 300)
  })
})

// GUARDS B1 / B5 — the netto expense type. The whole reason the two buckets are separate props is
// that the global „wszystko netto" toggle may reach ONE of them. These pin the seam by differencing
// against an identical composition with nothing billed netto, so they read the netto bucket's
// contribution directly rather than a hand-computed total.
describe('the netto-billed bucket is frozen against the materiały toggle', () => {
  const VAT = 0.23
  const REDUCTION = 0.08
  const NET_BILLED = 1000
  const GROSS_BASE = 123

  const combined = (materials: { grossBase: number; netBilled: number }, rate: number | null) =>
    combinedPair(1000, faceValue(billedMaterials(materials, rate)), VAT)

  it('B1: at a −8% toggle the netto bucket contributes its full amount, not ×0.92', () => {
    const base = combined(justGross(GROSS_BASE), REDUCTION)
    const withNet = combined({ grossBase: GROSS_BASE, netBilled: NET_BILLED }, REDUCTION)
    expect(withNet.net - base.net).toBeCloseTo(NET_BILLED)
    expect(withNet.net - base.net).not.toBeCloseTo(NET_BILLED / (1 + REDUCTION))
  })

  it('the VAT-strip default cannot reach it either', () => {
    const base = combined(justGross(GROSS_BASE), VAT)
    const withNet = combined({ grossBase: GROSS_BASE, netBilled: NET_BILLED }, VAT)
    expect(withNet.net - base.net).toBeCloseTo(NET_BILLED)
  })

  // „Pozostało do zapłaty" bills materiały once, so a netto expense moves BOTH axes by the same
  // netAmount — the grossed-up twin belongs to the Wydatki breakdown, which reads the two planes
  // separately, not to the settlement.
  it('a netto expense raises Pozostało do zapłaty by its netAmount on both axes', () => {
    const paid = { net: 300, gross: 300 }
    const base = computeAmountDue(1000, paid, justGross(GROSS_BASE), VAT, REDUCTION)
    const withNet = computeAmountDue(
      1000,
      paid,
      { grossBase: GROSS_BASE, netBilled: NET_BILLED },
      VAT,
      REDUCTION,
    )
    expect(withNet.net - base.net).toBeCloseTo(NET_BILLED)
    expect(withNet.gross - base.gross).toBeCloseTo(NET_BILLED)
  })

  it('B5: the billed figure carries the stored netAmount unrounded — list and summary agree', () => {
    const odd = 1234.56
    expect(billedMaterials({ grossBase: 0, netBilled: odd }, REDUCTION)).toBe(odd)
  })

  it('every tryb sees it — one billed figure, not a per-tryb composition', () => {
    const paid = { net: 400, gross: 400 }
    const base = computeAmountDue(700, paid, justGross(369), VAT, VAT)
    const withNet = computeAmountDue(700, paid, { grossBase: 369, netBilled: NET_BILLED }, VAT, VAT)
    expect(withNet.net - base.net).toBeCloseTo(NET_BILLED)
    expect(withNet.gross - base.gross).toBeCloseTo(NET_BILLED)
  })
})

// A section subtotal reduced to the two fields the totals formula reads, so the fixture states the
// scenario instead of restating `sectionSubtotalsForView`'s whole output shape.
const subtotal = (net: number, discount: number): SectionSubtotalT => ({
  sectionId: 1,
  sectionName: 'Sekcja',
  sectionColor: null,
  net,
  plannedNet: net,
  discount,
  share: 1,
  completionRatio: null,
  itemCount: 1,
})

describe('laborCostsNetPreDiscount — one „Robocizna", one number', () => {
  it('matches the suma prac the investment page reconciles against', () => {
    // Inwestycja 31: 18 000 zł wykonane, rabat na cały kosztorys 100 000 zł. The panel used to show
    // „Robocizna −82 000 zł" while „z kosztorysu" showed 18 000 zł — same label, two figures.
    const totals = clientTotalsFromSubtotals([subtotal(18_000, 0)], {
      type: 'amount',
      value: 100_000,
    })
    const laborCostsNet = totals.doneNet - totals.globalDiscountNet
    expect(laborCostsNet).toBe(-82_000)

    expect(laborCostsNetPreDiscount(laborCostsNet, totals.discountNetFromKosztorys)).toBe(
      totals.laborCostsNetFromKosztorys,
    )
    expect(totals.laborCostsNetFromKosztorys).toBe(18_000)
  })

  it('holds for a per-item rabat too, not just a global one', () => {
    const totals = clientTotalsFromSubtotals([subtotal(9_200, 800)], { type: null, value: 0 })
    const laborCostsNet = totals.doneNet - totals.globalDiscountNet

    expect(laborCostsNetPreDiscount(laborCostsNet, totals.discountNetFromKosztorys)).toBe(
      totals.laborCostsNetFromKosztorys,
    )
    expect(totals.laborCostsNetFromKosztorys).toBe(10_000)
  })

  it('relocating the rabat leaves Łącznie where it was: Robocizna − Rabat + Materiały', () => {
    const laborCostsNet = 90_000 // already post-rabat
    const discountAmount = 10_000
    const materials = justGross(12_300)
    const combined = combinedPair(laborCostsNet, faceValue(billedMaterials(materials, 0.23)), 0.23)

    const rows =
      laborCostsNetPreDiscount(laborCostsNet, discountAmount) -
      discountAmount +
      billedMaterials(materials, 0.23)

    expect(rows).toBeCloseTo(combined.net)
  })
})

// The reference defect, on the v2 settlement plane (investment 62): materiały the owner covered with
// a strata of the same amount, no robocizna and no wpłaty — the client owes nothing on either axis.
describe('investment 62 — an expense fully covered by a strata', () => {
  it('closes the settlement at zero on both planes', () => {
    const amountDue = computeAmountDue(
      0,
      { net: 0, gross: 0 },
      justGross(362.84),
      0.23,
      null,
      362.84,
    )

    expect(amountDue.net).toBeCloseTo(0)
    expect(amountDue.gross).toBeCloseTo(0)
  })
})
