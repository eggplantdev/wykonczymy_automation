import { describe, it, expect } from 'vitest'
import {
  WHERE_UNKNOWN,
  whereFilterOptions,
  whereFilterValue,
} from '@/components/equipment/where-filter-options'
import type { EquipmentRowT } from '@/lib/equipment/types'

// The one dropdown that replaces a warehouse screen: people and warehouses are pickable side by
// side, every workshop collapses onto one row, and an item nobody can place gets an option of its
// own — without it, picking any place would hide it with no way left to bring it back.

const row = (overrides: Partial<EquipmentRowT>): EquipmentRowT => ({
  id: 1,
  name: 'Wiertarka',
  serialNumber: '',
  make: '',
  model: '',
  status: 'IN_USE',
  purchaseDate: null,
  warrantyUntil: null,
  purchasePrice: null,
  note: '',
  location: { kind: 'unknown' },
  locatedAt: null,
  investmentName: '',
  ...overrides,
})

const holder = (id: number, name: string) =>
  row({ id, location: { kind: 'holder', id, name } })
const warehouse = (id: number, name: string) =>
  row({ id: id + 100, location: { kind: 'warehouse', id, name } })

describe('whereFilterOptions', () => {
  it('puts people before warehouses, each alphabetically', () => {
    const options = whereFilterOptions([
      warehouse(2, 'Zaplecze'),
      holder(3, 'Zenon Kowal'),
      warehouse(1, 'Magazyn główny'),
      holder(4, 'Anna Nowak'),
    ])

    expect(options.map((option) => option.label)).toEqual([
      'Anna Nowak',
      'Zenon Kowal',
      'Magazyn główny',
      'Zaplecze',
    ])
  })

  // Person 3 and warehouse 3 are different places; only the prefixed value keeps them apart.
  it('gives a person and a warehouse of the same id different values', () => {
    const options = whereFilterOptions([holder(3, 'Anna'), warehouse(3, 'Magazyn')])

    expect(new Set(options.map((option) => option.value)).size).toBe(2)
  })

  it('collapses every workshop onto one row', () => {
    const options = whereFilterOptions([
      row({ id: 1, location: { kind: 'service', name: 'Serwis A' } }),
      row({ id: 2, location: { kind: 'service', name: 'Serwis B' } }),
    ])

    expect(options).toEqual([{ value: 'service', label: 'W serwisie' }])
  })

  it('offers the unknown option when a live item has no location', () => {
    const options = whereFilterOptions([row({ status: 'IN_USE' })])

    expect(options).toEqual([{ value: WHERE_UNKNOWN, label: 'Nie wiadomo gdzie' }])
  })

  // A sold drill has nobody holding it BY DEFINITION — offering „nie wiadomo gdzie" would invite a
  // hunt for something that is not missing.
  it('does not offer the unknown option for an item that is no longer ours', () => {
    expect(whereFilterOptions([row({ status: 'SOLD' })])).toEqual([])
  })

  it('lists each person once however many items they hold', () => {
    const options = whereFilterOptions([holder(3, 'Anna Nowak'), holder(3, 'Anna Nowak')])

    expect(options).toHaveLength(1)
  })
})

describe('whereFilterValue', () => {
  // The value a row answers to has to be the one the option carries, or the filter hides everything.
  it('matches the option value of the place the item is in', () => {
    const rows = [holder(3, 'Anna Nowak'), warehouse(1, 'Magazyn główny'), row({ id: 9 })]
    const values = new Set(whereFilterOptions(rows).map((option) => option.value))

    for (const candidate of rows) {
      expect(values.has(whereFilterValue(candidate))).toBe(true)
    }
  })
})
