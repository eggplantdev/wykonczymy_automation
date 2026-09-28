import { describe, it, expect } from 'vitest'
import { diffVersions } from '@/lib/kosztorys/history/diff-versions'
import { summarizeChange } from '@/lib/kosztorys/history/summarize-change'
import type { HistoryVersionT } from '@/lib/kosztorys/history/types'
import { item, stage, version } from '@/__tests__/helpers/kosztorys-history'

const summary = (past: HistoryVersionT, current: HistoryVersionT) =>
  summarizeChange(diffVersions(past, current))

describe('summarizeChange', () => {
  it('counts added and removed pozycje in Polish', () => {
    const past = version([item(1, 'Skucie', 8, 40)])
    const current = version([
      item(2, 'Płytki', 10, 100),
      item(3, 'Fugi', 10, 20),
      item(4, 'Silikon', 3, 15),
    ])
    expect(summary(past, current)).toBe('3 prace dodane · 1 praca usunięta')
  })

  it('names Przedmiar and Cena j.m. changes by count', () => {
    const past = version([item(1, 'Płytki', 10, 100), item(2, 'Fugi', 10, 20)])
    const current = version([item(1, 'Płytki', 12, 110), item(2, 'Fugi', 11, 20)])
    expect(summary(past, current)).toBe(
      'Przedmiar zmieniony w 2 pracach · Cena j.m. zmieniona w 1 pracy',
    )
  })

  it('sums Pomiar per etap when one j.m. covers it, and counts it when units mix', () => {
    const stages = [stage(7, 1, 'Płytki'), stage(8, 2)]
    const items = [
      item(1, 'Płytki ściany', 20, 100, { unit: 'm²' }),
      item(2, 'Płytki podłoga', 10, 100, { unit: 'm²' }),
      item(3, 'Listwy', 10, 30, { unit: 'mb' }),
    ]
    const past = version(items, stages, [])
    const current = version(items, stages, [
      { itemId: 1, stageId: 7, qtyDone: 8 },
      { itemId: 2, stageId: 7, qtyDone: 4 },
      { itemId: 2, stageId: 8, qtyDone: 1 },
      { itemId: 3, stageId: 8, qtyDone: 2 },
    ])
    expect(summary(past, current)).toBe(
      'Pomiar w etapie Płytki: +12 m² · Pomiar w etapie Etap 2 zmieniony w 2 pracach',
    )
  })

  it('shows a rabat change old → new, and nothing for an unknown one', () => {
    const items = [item(1, 'Płytki', 10, 100)]
    const withDiscount = (value: number) =>
      version(items, [], [], { globalDiscount: { type: 'amount', value } })

    expect(summary(withDiscount(500), withDiscount(300))).toMatch(
      /^Rabat: 500,00\szł → 300,00\szł$/,
    )
    expect(summary({ ...withDiscount(500), discount: { known: false } }, withDiscount(300))).toBe(
      '',
    )
  })
})
