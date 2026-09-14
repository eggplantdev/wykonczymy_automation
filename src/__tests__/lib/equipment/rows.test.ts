import { describe, it, expect } from 'vitest'
import { locationKey, toEquipmentEventRow, toEquipmentRow, toLocation } from '@/lib/equipment/rows'

// The mapper is where three mutually exclusive columns collapse into one answer to „gdzie jest",
// and where an unknown price must stay unknown. Both are read on every row of the listing.

const NO_TARGET = {
  holder_id: null,
  holder_name: null,
  warehouse_id: null,
  warehouse_name: null,
  service_provider: null,
}

describe('toLocation', () => {
  it('reads a person off the holder columns', () => {
    expect(toLocation({ ...NO_TARGET, holder_id: 3, holder_name: 'Anna Nowak' })).toEqual({
      kind: 'holder',
      id: 3,
      name: 'Anna Nowak',
    })
  })

  it('reads a warehouse off the warehouse columns', () => {
    expect(
      toLocation({ ...NO_TARGET, warehouse_id: 2, warehouse_name: 'Magazyn główny' }),
    ).toEqual({ kind: 'warehouse', id: 2, name: 'Magazyn główny' })
  })

  it('reads a workshop off the free-text column', () => {
    expect(toLocation({ ...NO_TARGET, service_provider: 'Serwis Boscha' })).toEqual({
      kind: 'service',
      name: 'Serwis Boscha',
    })
  })

  // An item entered into the register but never handed anywhere: no event, so no target columns.
  it('answers unknown when nothing has happened to the item yet', () => {
    expect(toLocation(NO_TARGET)).toEqual({ kind: 'unknown' })
  })

  // „W serwisie u nikogo" is not a location, and a blank string is what a cleared text field leaves.
  it('treats a blank workshop as no target', () => {
    expect(toLocation({ ...NO_TARGET, service_provider: '   ' })).toEqual({ kind: 'unknown' })
  })
})

describe('locationKey', () => {
  // The whole reason the key is prefixed: person 3 and warehouse 3 share one dropdown.
  it('keeps a person and a warehouse of the same id apart', () => {
    expect(locationKey({ kind: 'holder', id: 3, name: 'Anna' })).not.toBe(
      locationKey({ kind: 'warehouse', id: 3, name: 'Magazyn' }),
    )
  })

  it('collapses every workshop onto one key', () => {
    expect(locationKey({ kind: 'service', name: 'Serwis A' })).toBe(
      locationKey({ kind: 'service', name: 'Serwis B' }),
    )
  })

  it('gives an item with no history no key to filter by', () => {
    expect(locationKey({ kind: 'unknown' })).toBeNull()
  })
})

describe('toEquipmentRow', () => {
  it('maps an item with its current holder', () => {
    const row = toEquipmentRow({
      id: 7,
      name: 'Młot wyburzeniowy',
      serial_number: 'HM-1900',
      make: 'Makita',
      model: 'HM1213C',
      status: 'IN_USE',
      purchase_date: '2025-03-01T00:00:00.000Z',
      warranty_until: '2027-03-01T00:00:00.000Z',
      purchase_price: '4200.50',
      note: '',
      occurred_at: '2026-08-20T00:00:00.000Z',
      ...NO_TARGET,
      holder_id: 3,
      holder_name: 'Anna Nowak',
    })

    expect(row).toMatchObject({
      id: 7,
      name: 'Młot wyburzeniowy',
      serialNumber: 'HM-1900',
      status: 'IN_USE',
      purchasePrice: 4200.5,
      locatedAt: '2026-08-20T00:00:00.000Z',
      location: { kind: 'holder', id: 3, name: 'Anna Nowak' },
    })
  })

  // „Nieznana cena" and „0 zł" are different facts and render differently.
  it('keeps an unknown purchase price null rather than zero', () => {
    const row = toEquipmentRow({ id: 1, name: 'Wiertarka', purchase_price: null, ...NO_TARGET })

    expect(row.purchasePrice).toBeNull()
  })

  it('leaves an item with no events without a location date', () => {
    const row = toEquipmentRow({ id: 1, name: 'Wiertarka', occurred_at: null, ...NO_TARGET })

    expect(row.locatedAt).toBeNull()
    expect(row.location).toEqual({ kind: 'unknown' })
  })

  // Postgres hands a day-only column back as a Date at midnight UTC, and a full ISO timestamp is
  // exactly what the form's date picker cannot parse — „Edytuj sprzęt" opened with both dates blank.
  it('maps day-only columns to the YYYY-MM-DD the pickers speak', () => {
    const row = toEquipmentRow({
      id: 1,
      name: 'Wiertarka',
      purchase_date: new Date('2025-03-01T00:00:00.000Z'),
      warranty_until: new Date('2026-12-01T00:00:00.000Z'),
      ...NO_TARGET,
    })

    expect(row.purchaseDate).toBe('2025-03-01')
    expect(row.warrantyUntil).toBe('2026-12-01')
  })

  it('leaves an item with no warranty date null rather than dating it today', () => {
    const row = toEquipmentRow({ id: 1, name: 'Wiertarka', warranty_until: null, ...NO_TARGET })

    expect(row.warrantyUntil).toBeNull()
  })

  // The enum widened without the constant would otherwise hide the item from every status filter.
  it('falls back to IN_USE for a status the constant does not know', () => {
    expect(toEquipmentRow({ id: 1, name: 'X', status: 'SCRAPPED', ...NO_TARGET }).status).toBe(
      'IN_USE',
    )
  })
})

describe('toEquipmentEventRow', () => {
  it('maps a service entry with its cost', () => {
    const event = toEquipmentEventRow({
      id: 11,
      occurred_at: '2026-08-20T00:00:00.000Z',
      ...NO_TARGET,
      service_provider: 'Serwis Boscha',
      investment_id: null,
      investment_name: null,
      cost: '349.00',
      note: 'wymiana szczotek',
      created_by_name: 'Bartek Kowalczyk',
    })

    expect(event).toEqual({
      id: 11,
      occurredAt: '2026-08-20T00:00:00.000Z',
      target: { kind: 'service', name: 'Serwis Boscha' },
      investmentName: '',
      cost: 349,
      note: 'wymiana szczotek',
      createdByName: 'Bartek Kowalczyk',
    })
  })

  it('leaves a handover without a cost', () => {
    const event = toEquipmentEventRow({
      id: 12,
      occurred_at: '2026-08-21T00:00:00.000Z',
      ...NO_TARGET,
      holder_id: 3,
      holder_name: 'Anna Nowak',
    })

    expect(event.cost).toBeNull()
  })
})
