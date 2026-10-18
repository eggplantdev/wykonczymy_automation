import { describe, it, expect } from 'vitest'
import { sameDailyState } from '@/lib/kosztorys/capture-daily-snapshots'
import { serializeTree } from '@/lib/kosztorys/serialize-tree'
import { oneWorkerSplit } from '@/lib/kosztorys/stage-split'
import type { StoredSnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import type { KosztorysItemT, KosztorysTreeT } from '@/lib/kosztorys/types'
import { item, stage, tree } from '@/__tests__/helpers/kosztorys-history'

const liveTree = (overrides: Partial<KosztorysItemT> = {}, rest: Partial<KosztorysTreeT> = {}) =>
  tree(
    [item(1, 'Płytki', 10, 100, overrides)],
    [{ ...stage(7, 1, 'Płytki'), split: oneWorkerSplit(42) }],
    [{ itemId: 1, stageId: 7, qtyDone: 3 }],
    { globalDiscount: { type: 'amount', value: 250 }, ...rest },
  )

// What jsonb hands back: no `undefined` keys.
const stored = (live: KosztorysTreeT): StoredSnapshotPayloadT =>
  JSON.parse(JSON.stringify(serializeTree(live)))

function withoutDeployAddedKeys(payload: StoredSnapshotPayloadT): StoredSnapshotPayloadT {
  return {
    ...payload,
    items: payload.items.map(
      ({
        aiRecheck: _aiRecheck,
        aiNewInformation: _aiNewInformation,
        catalogueItemId: _catalogueItemId,
        currentPlannedQty: _currentPlannedQty,
        aiPlannedQty: _aiPlannedQty,
        reviewStatus: _reviewStatus,
        changeReason: _changeReason,
        ...rest
      }) => rest,
    ),
    stages: payload.stages.map(({ split: _split, completed: _completed, ...rest }) => ({
      ...rest,
      workerId: 42,
    })),
  }
}

describe('sameDailyState', () => {
  it('treats an unchanged tree as the same day', () => {
    const live = liveTree()
    expect(sameDailyState(stored(live), serializeTree(live), live)).toBe(true)
  })

  it('does not count keys a deploy added at their default as a change', () => {
    const live = liveTree()
    const previous = withoutDeployAddedKeys(stored(live))
    expect(sameDailyState(previous, serializeTree(live), live)).toBe(true)
  })

  it('counts a key the previous row lacked once it holds a real value', () => {
    const before = withoutDeployAddedKeys(stored(liveTree()))
    const live = liveTree({ catalogueItemId: 5 })
    expect(sameDailyState(before, serializeTree(live), live)).toBe(false)
  })

  it('counts an edited Przedmiar as a change', () => {
    const previous = stored(liveTree())
    const live = liveTree({ plannedQty: 12 })
    expect(sameDailyState(previous, serializeTree(live), live)).toBe(false)
  })

  it('counts a changed rabat as a change', () => {
    const previous = stored(liveTree())
    const live = liveTree({}, { globalDiscount: { type: 'amount', value: 300 } })
    expect(sameDailyState(previous, serializeTree(live), live)).toBe(false)
  })
})
