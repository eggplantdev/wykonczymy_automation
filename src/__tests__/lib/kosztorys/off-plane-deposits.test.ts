import { describe, expect, it } from 'vitest'
import {
  depositsStrandedBy,
  isOffPlaneDeposit,
  offPlaneDeposits,
  strandedFromPlaneSums,
  strandsDeposit,
} from '@/lib/kosztorys/off-plane-deposits'
import { bucketDepositsByPlane } from '@/lib/kosztorys/deposit-planes'
import { cash, transfer, untagged } from '@/__tests__/helpers/deposit-rows'
import { SETTLEMENT_MODES, type SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import type { VatPlaneT } from '@/lib/constants/transfers'

describe('the two off-plane predicates', () => {
  const PLANES: (VatPlaneT | null)[] = ['NET', 'GROSS', null]
  const row = (vatPlane: VatPlaneT | null) => ({ vatPlane })

  const OFF_PLANE: Record<SettlementModeT, Record<string, boolean>> = {
    NET: { NET: false, GROSS: true, null: false },
    GROSS: { NET: true, GROSS: false, null: true },
    MIXED: { NET: false, GROSS: false, null: false },
  }

  const STRANDS: Record<SettlementModeT, Record<string, boolean>> = {
    NET: { NET: false, GROSS: false, null: false },
    GROSS: { NET: true, GROSS: false, null: true },
    MIXED: { NET: false, GROSS: false, null: false },
  }

  for (const mode of SETTLEMENT_MODES) {
    for (const plane of PLANES) {
      const key = String(plane)

      it(`tryb ${mode}, wpłata ${key}: off-plane=${OFF_PLANE[mode][key]}, strands=${STRANDS[mode][key]}`, () => {
        expect(isOffPlaneDeposit(row(plane), mode)).toBe(OFF_PLANE[mode][key])
        expect(strandsDeposit(plane, mode)).toBe(STRANDS[mode][key])
      })
    }
  }

  it('only tryb brutto strands anything — a przelew on a netto bill still pays the debt down', () => {
    expect(isOffPlaneDeposit(row('GROSS'), 'NET')).toBe(true)
    expect(strandsDeposit('GROSS', 'NET')).toBe(false)
  })

  it('tryb mieszany is the answer, so it never raises either flag', () => {
    for (const plane of PLANES) {
      expect(isOffPlaneDeposit(row(plane), 'MIXED')).toBe(false)
      expect(strandsDeposit(plane, 'MIXED')).toBe(false)
    }
  })
})

describe('offPlaneDeposits', () => {
  it('returns the rows themselves, so a count can be traced back to wpłaty', () => {
    const rows = [cash(100), transfer(1230, 950), untagged(50)]
    expect(offPlaneDeposits(rows, 'NET')).toEqual([rows[1]])
    expect(offPlaneDeposits(rows, 'GROSS')).toEqual([rows[0], rows[2]])
    expect(offPlaneDeposits(rows, 'MIXED')).toEqual([])
  })
})

describe('depositsStrandedBy', () => {
  it('sums the face value of what a switch to brutto would silence', () => {
    expect(depositsStrandedBy([cash(100), untagged(50), transfer(1230, 950)], 'GROSS')).toEqual({
      count: 2,
      amount: 150,
    })
  })

  it('a switch to netto or mieszane strands nothing', () => {
    const rows = [cash(100), transfer(1230, 950)]
    expect(depositsStrandedBy(rows, 'NET')).toEqual({ count: 0, amount: 0 })
    expect(depositsStrandedBy(rows, 'MIXED')).toEqual({ count: 0, amount: 0 })
  })
})

describe('strandedFromPlaneSums', () => {
  const sums = bucketDepositsByPlane([cash(100), untagged(50), transfer(1230, 950)])

  it('in tryb brutto reports the netto bucket — count and face value', () => {
    expect(strandedFromPlaneSums(sums, 'GROSS')).toEqual({ count: 2, amount: 150 })
  })

  it('agrees with the row-level count, so panel and listing cannot say different numbers', () => {
    const rows = [cash(100), untagged(50), transfer(1230, 950)]
    expect(strandedFromPlaneSums(bucketDepositsByPlane(rows), 'GROSS')).toEqual(
      depositsStrandedBy(rows, 'GROSS'),
    )
  })

  it('is absent outside tryb brutto — nothing is stranded, so there is nothing to mark', () => {
    expect(strandedFromPlaneSums(sums, 'NET')).toBeUndefined()
    expect(strandedFromPlaneSums(sums, 'MIXED')).toBeUndefined()
  })

  it('is absent in tryb brutto when every wpłata came przelewem', () => {
    expect(
      strandedFromPlaneSums(bucketDepositsByPlane([transfer(1230, 950)]), 'GROSS'),
    ).toBeUndefined()
  })
})
