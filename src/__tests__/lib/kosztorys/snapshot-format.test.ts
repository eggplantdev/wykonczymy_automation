import { describe, it, expect } from 'vitest'
import { itemWithColumnDefaults } from '@/lib/kosztorys/snapshot-format'
import type { StoredSnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'

type StoredItemT = StoredSnapshotPayloadT['items'][number]

const storedItem = (extra: Partial<StoredItemT> = {}): StoredItemT => ({
  id: 10,
  ref: 1,
  sectionId: 1,
  description: 'Gładzie',
  unit: 'm2',
  sheetMeasuredQty: null,
  discountType: null,
  note: null,
  ...extra,
})

// Every szablon and snapshot stored before EX-1017 lacks the key; restoring one must not invent a
// link, and one stored since must keep the link it was saved with.
describe('itemWithColumnDefaults — katalog link', () => {
  it('reads a payload without the field as no katalog entry', () => {
    expect(itemWithColumnDefaults(storedItem(), 0).catalogueItemId).toBeNull()
  })

  it('keeps the katalog entry a payload carries', () => {
    expect(itemWithColumnDefaults(storedItem({ catalogueItemId: 42 }), 0).catalogueItemId).toBe(42)
  })
})
