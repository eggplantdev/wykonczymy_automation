import { describe, expect, it } from 'vitest'
import { diffVersions } from '@/lib/kosztorys/history/diff-versions'
import {
  cellChange,
  historyGridTree,
  stageIdsFilledNow,
} from '@/lib/kosztorys/history/history-grid'
import { liveVersion } from '@/lib/kosztorys/history/snapshot-to-tree'
import type { PastVersionT } from '@/lib/kosztorys/history/types'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import { item, stage, tree, version } from '@/__tests__/helpers/kosztorys-history'

describe('history grid', () => {
  // The etap was added after the version was stored, and a pomiar was typed into it since.
  const past = version([item(1, 'Płytki', 12, 100)])
  const added = stage(7, 1, 'Płytki')
  const diff = diffVersions(
    past,
    liveVersion(
      tree([item(1, 'Płytki', 12, 100)], [added], [{ itemId: 1, stageId: 7, qtyDone: 5 }]),
    ),
  )
  const pastVersion: PastVersionT = {
    tree: past.tree,
    id: 1,
    label: null,
    day: '2026-01-12',
    diff,
  }

  it('gives an etap added since a column of its own in the past grid', () => {
    expect(historyGridTree(pastVersion).stages.map(({ id }) => id)).toEqual([7])
  })

  it('lands its pomiar on that column as 0 → new', () => {
    expect(cellChange(diff, 1, stageKey(7))).toMatchObject({ before: 0, after: 5 })
    expect(stageIdsFilledNow(diff)).toEqual(new Set([7]))
  })

  it('has no change for a column nothing moved in', () => {
    expect(cellChange(diff, 1, 'price')).toBeUndefined()
  })
})
