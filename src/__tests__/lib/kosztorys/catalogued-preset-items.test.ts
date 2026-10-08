import { describe, it, expect } from 'vitest'
import { keepCataloguedItems, skippedItemsWarning } from '@/lib/kosztorys/catalogued-preset-items'
import type { SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'

const item = (catalogueItemId: number | null) =>
  ({ catalogueItemId }) as SnapshotPayloadT['items'][number]

const treeOf = (...items: SnapshotPayloadT['items']) =>
  ({ schemaVersion: 1, sections: [{ id: 1 }], items }) as unknown as SnapshotPayloadT

describe('keepCataloguedItems', () => {
  it('keeps a praca whose katalog entry still exists', () => {
    const { tree, skipped } = keepCataloguedItems(treeOf(item(7)), new Set([7]))

    expect(tree.items.map((kept) => kept.catalogueItemId)).toEqual([7])
    expect(skipped).toBe(0)
  })

  it('skips a praca typed by hand and one whose entry was deleted, keeping the sekcje', () => {
    const { tree, skipped } = keepCataloguedItems(
      treeOf(item(null), item(9), item(7)),
      new Set([7]),
    )

    expect(tree.items.map((kept) => kept.catalogueItemId)).toEqual([7])
    expect(tree.sections).toHaveLength(1)
    expect(skipped).toBe(2)
  })
})

describe('skippedItemsWarning', () => {
  it.each([
    [1, 'Pominięto 1 pracę spoza katalogu'],
    [3, 'Pominięto 3 prace spoza katalogu'],
    [5, 'Pominięto 5 prac spoza katalogu'],
  ])('declines the noun for %i', (count, start) => {
    expect(skippedItemsWarning(count)).toBe(`${start} — najpierw zapisz je do katalogu.`)
  })
})
