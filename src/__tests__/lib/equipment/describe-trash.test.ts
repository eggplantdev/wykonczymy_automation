import { describe, it, expect } from 'vitest'
import { describeEquipmentTrash } from '@/lib/equipment/describe-trash'

const LOST = 'Po 30 dniach zniknie razem z historią przekazań.'

describe('describeEquipmentTrash', () => {
  it('names the worker who still has the item', () => {
    expect(
      describeEquipmentTrash({
        name: 'Szlifierka',
        location: { kind: 'holder', id: 1, name: 'Jan Kowalski' },
      }),
    ).toBe(
      `Przenieść „Szlifierka" do kosza? Możesz go przywrócić z Kosza. Teraz ma go Jan Kowalski. ${LOST}`,
    )
  })

  it('names the warehouse and the workshop', () => {
    expect(
      describeEquipmentTrash({
        name: 'Wiertarka',
        location: { kind: 'warehouse', id: 2, name: 'Bemowo' },
      }),
    ).toContain('Leży w magazynie „Bemowo".')
    expect(
      describeEquipmentTrash({ name: 'Wiertarka', location: { kind: 'service', name: 'Hilti' } }),
    ).toContain('Jest w serwisie: Hilti.')
  })

  it('says nothing about where an item is that has never moved', () => {
    expect(describeEquipmentTrash({ name: 'Wiertarka', location: { kind: 'unknown' } })).toBe(
      `Przenieść „Wiertarka" do kosza? Możesz go przywrócić z Kosza. ${LOST}`,
    )
  })
})
