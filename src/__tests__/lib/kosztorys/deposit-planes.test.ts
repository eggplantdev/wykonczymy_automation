import { describe, expect, it } from 'vitest'
import {
  bucketDepositsByPlane,
  depositPairFromPlaneSums,
  depositRowPair,
  sumDeposits,
} from '@/lib/kosztorys/deposit-planes'
import { cash, netlessTransfer, transfer, untagged } from '@/__tests__/helpers/deposit-rows'

describe('depositRowPair', () => {
  it('a gotówka is netto only — its brutto is „nie dotyczy", never zero', () => {
    expect(depositRowPair(cash(1000))).toEqual({ net: 1000, gross: null })
  })

  it('an untagged wpłata counts as gotówka (owner: „brak wartości = netto")', () => {
    expect(depositRowPair(untagged(400))).toEqual({ net: 400, gross: null })
  })

  it('a przelew reads BOTH kwoty off its faktura, not one crossed at VAT', () => {
    // 1230 / 1,23 would be 1000 — the faktura says 950 because materiały entered it at their own
    // rate.
    expect(depositRowPair(transfer(1230, 950))).toEqual({ net: 950, gross: 1230 })
  })

  it('a przelew with no netto is worth 0 zł netto — none is estimated at VAT', () => {
    expect(depositRowPair(netlessTransfer(1230))).toEqual({ net: 0, gross: 1230 })
  })
})

describe('bucketDepositsByPlane', () => {
  it('splits the sums by what each row carries', () => {
    const sums = bucketDepositsByPlane([cash(100), untagged(50), transfer(1230, 950)])

    expect(sums).toEqual({ paidNet: 150, paidGrossNet: 950, paidGross: 1230, paidNetCount: 2 })
  })

  it('a przelew with no netto lands on brutto alone, adding nothing to netto', () => {
    expect(bucketDepositsByPlane([netlessTransfer(246)])).toEqual({
      paidNet: 0,
      paidGrossNet: 0,
      paidGross: 246,
      paidNetCount: 0,
    })
  })

  it('empty list yields zeroed sums', () => {
    expect(bucketDepositsByPlane([])).toEqual({
      paidNet: 0,
      paidGrossNet: 0,
      paidGross: 0,
      paidNetCount: 0,
    })
  })
})

describe('depositPairFromPlaneSums', () => {
  it('adds the two netto buckets and leaves brutto alone', () => {
    const pair = depositPairFromPlaneSums({
      paidNet: 150,
      paidGrossNet: 950,
      paidGross: 1476,
      paidNetCount: 2,
    })

    expect(pair).toEqual({ net: 1100, gross: 1476 })
  })

  it('counts ONLY przelewy on the brutto plane', () => {
    expect(depositPairFromPlaneSums(bucketDepositsByPlane([cash(5000)])).gross).toBe(0)
  })
})

describe('sumDeposits', () => {
  it('reduces a mixed list to one pair: every netto counted, only przelewy on brutto', () => {
    const rows = [cash(1000), untagged(500), transfer(1230, 950)]
    expect(sumDeposits(rows)).toEqual({ net: 2450, gross: 1230 })
  })

  it('gotówka alone leaves the brutto plane at zero — nothing is grossed up to fill it', () => {
    expect(sumDeposits([cash(1000), untagged(500)])).toEqual({ net: 1500, gross: 0 })
  })
})
