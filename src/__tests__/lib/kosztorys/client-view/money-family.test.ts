import { describe, expect, it } from 'vitest'
import { CLIENT_VIEW_GROUPS } from '@/lib/kosztorys/client-view/columns'
import {
  groupsForMoneyFamily,
  isListedInMoneyFamily,
} from '@/lib/kosztorys/client-view/money-family'
import {
  STAGE_VALUE_GROSS_COLUMN_GROUP,
  STAGE_VALUE_NET_COLUMN_GROUP,
} from '@/lib/kosztorys/stage-keys'

const keysOf = (family: 'net' | 'gross') =>
  groupsForMoneyFamily(CLIENT_VIEW_GROUPS, family).flatMap((group) => group.keys)

describe('groupsForMoneyFamily', () => {
  it('returns the netto groups as they are', () => {
    expect(groupsForMoneyFamily(CLIENT_VIEW_GROUPS, 'net')).toBe(CLIENT_VIEW_GROUPS)
  })

  it('swaps every netto money key for its brutto twin in place', () => {
    const net = keysOf('net')
    const gross = keysOf('gross')

    expect(gross).toHaveLength(net.length)
    expect(gross[net.indexOf('price')]).toBe('priceGross')
    expect(gross[net.indexOf('net')]).toBe('gross')
    expect(gross[net.indexOf(STAGE_VALUE_NET_COLUMN_GROUP)]).toBe(STAGE_VALUE_GROSS_COLUMN_GROUP)
  })

  it('leaves quantities, rabat type and % untouched', () => {
    const gross = keysOf('gross')
    for (const key of ['plannedQty', 'unit', 'discountType', 'discountValue', 'donePercent']) {
      expect(gross).toContain(key)
    }
  })
})

describe('isListedInMoneyFamily', () => {
  it.each([
    ['price', 'net', true],
    ['priceGross', 'net', false],
    ['price', 'gross', false],
    ['priceGross', 'gross', true],
    ['unit', 'net', true],
    ['unit', 'gross', true],
  ] as const)('„%s" under %s → %s', (key, family, listed) => {
    expect(isListedInMoneyFamily(key, family)).toBe(listed)
  })
})
