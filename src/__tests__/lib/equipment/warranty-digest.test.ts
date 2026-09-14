import { describe, expect, it } from 'vitest'
import { buildEquipmentDigest } from '@/lib/equipment/digest'
import { classifyWarranty } from '@/lib/equipment/warranty-thresholds'
import { resetWarrantyBookkeeping } from '@/lib/equipment/reset-warranty-bookkeeping'
import type { EquipmentWarrantyRowT } from '@/lib/equipment/types'

const TODAY = '2026-09-03'

const day = (offset: number): string => {
  const date = new Date(Date.parse(`${TODAY}T00:00:00Z`) + offset * 86_400_000)
  return date.toISOString().slice(0, 10)
}

const row = (overrides: Partial<EquipmentWarrantyRowT> = {}): EquipmentWarrantyRowT => ({
  id: 1,
  name: 'Szlifierka',
  make: 'Bosch',
  model: 'GWS 750',
  serialNumber: 'SN-1',
  status: 'IN_USE',
  warrantyUntil: day(7),
  warrantyNotifiedBucket: null,
  ...overrides,
})

describe('classifyWarranty — boundaries', () => {
  it.each([
    [31, null],
    [30, 30],
    [8, 30],
    [7, 7],
    [0, 7],
    [-1, 0],
  ])('%i days left → bucket %s', (daysLeft, bucket) => {
    expect(classifyWarranty(day(daysLeft), TODAY)).toBe(bucket)
  })

  it('says nothing about an item with no warranty date', () => {
    expect(classifyWarranty(null, TODAY)).toBeNull()
  })
})

describe('buildEquipmentDigest', () => {
  it('sorts an item into the bucket it just entered', () => {
    const digest = buildEquipmentDigest([row({ warrantyUntil: day(30) })], TODAY)

    expect(digest.within30).toHaveLength(1)
    expect(digest.within7).toHaveLength(0)
    expect(digest.within30[0].daysLeft).toBe(30)
    expect(digest.stamps).toEqual([{ equipmentId: 1, bucket: 30 }])
  })

  it('never mails a warranty that has already lapsed', () => {
    const digest = buildEquipmentDigest([row({ warrantyUntil: day(-1) })], TODAY)

    expect(digest.stamps).toEqual([])
    expect(digest.within7).toHaveLength(0)
    expect(digest.within30).toHaveLength(0)
  })

  it('does not mail the same bucket twice', () => {
    const rows = [row({ warrantyUntil: day(20), warrantyNotifiedBucket: 30 })]

    expect(buildEquipmentDigest(rows, TODAY).stamps).toEqual([])
  })

  it('escalates from the 30-day bucket to the 7-day one', () => {
    const rows = [row({ warrantyUntil: day(5), warrantyNotifiedBucket: 30 })]
    const digest = buildEquipmentDigest(rows, TODAY)

    expect(digest.within7).toHaveLength(1)
    expect(digest.stamps).toEqual([{ equipmentId: 1, bucket: 7 }])
  })

  it('leaves anything that is no longer in use out of the digest', () => {
    const digest = buildEquipmentDigest([row({ status: 'SOLD' })], TODAY)

    expect(digest.stamps).toEqual([])
  })

  it('says nothing about an item with no warranty recorded', () => {
    const digest = buildEquipmentDigest([row({ warrantyUntil: null })], TODAY)

    expect(digest.stamps).toEqual([])
  })
})

describe('extending a warranty', () => {
  it('clears the bookkeeping so the new date can mail again', () => {
    const cleared = resetWarrantyBookkeeping({ warrantyUntil: day(5) }, { warrantyUntil: day(400) })
    expect(cleared).toEqual({ warrantyNotifiedBucket: null, warrantyNotifiedAt: null })

    const rows = [
      row({ warrantyUntil: day(30), warrantyNotifiedBucket: cleared.warrantyNotifiedBucket ?? null }),
    ]
    expect(buildEquipmentDigest(rows, TODAY).stamps).toEqual([{ equipmentId: 1, bucket: 30 }])
  })

  it('leaves the stamp alone when the sweep writes only its own bookkeeping', () => {
    expect(resetWarrantyBookkeeping({ warrantyUntil: day(5) }, {})).toEqual({})
  })
})
