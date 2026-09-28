import { describe, it, expect } from 'vitest'
import { serializeTree } from '@/lib/kosztorys/serialize-tree'
import { snapshotToTree } from '@/lib/kosztorys/history/snapshot-to-tree'
import type { StoredSnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { item, stage, tree } from '@/__tests__/helpers/kosztorys-history'

const live = tree([item(1, 'Płytki', 10, 100)], [], [], {
  globalDiscount: { type: 'amount', value: 250 },
  vatRate: 0.08,
})

describe('snapshotToTree', () => {
  it('renders a stored payload through the same rows as the live tree', () => {
    const stored = tree(
      [item(1, 'Płytki', 12, 90), item(2, 'Fugi', 4, 20)],
      [stage(7, 1, 'Płytki')],
      [{ itemId: 1, stageId: 7, qtyDone: 3 }],
      { globalDiscount: { type: null, value: 0 } },
    )
    const { tree: rebuilt, discount } = snapshotToTree(serializeTree(stored), live)

    expect(treeToRows(rebuilt)).toEqual(treeToRows(stored))
    expect(discount).toEqual({ known: true, type: null, value: 0 })
  })

  // Rendering `?? 0` here is the bug: an old version would claim the investor had no rabat.
  it('marks the rabat of a payload stored before the history shipped as unknown, never 0', () => {
    const { globalDiscount: _dropped, ...old } = serializeTree(tree([item(1, 'Płytki', 10, 100)]))
    const { discount, tree: rebuilt } = snapshotToTree(old, live)

    expect(discount).toEqual({ known: false })
    expect(rebuilt.globalDiscount).toEqual(live.globalDiscount)
  })

  it('fills what an old payload never carried from its column defaults and the live tree', () => {
    const payload = {
      schemaVersion: 1,
      sections: [{ id: 10, name: 'Łazienka', color: null }],
      items: [{ ...item(1, 'Płytki', 10, 100), plannedQty: undefined, clientPrice: undefined }],
      stages: [],
      progress: [],
    } as unknown as StoredSnapshotPayloadT

    const { tree: rebuilt } = snapshotToTree(payload, live)
    expect(rebuilt.vatRate).toBe(0.08)
    expect(rebuilt.sections[0].displayOrder).toBe(0)
    expect(rebuilt.sections[0].items[0]).toMatchObject({ plannedQty: 0, clientPrice: 0 })
  })
})
