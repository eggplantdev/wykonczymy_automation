'use client'

import { useState } from 'react'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import type { SortStateT } from '@/lib/kosztorys/row-view'

export type EditorViewLatchT = {
  ids: Set<number>
  rank: Map<number, number>
  stageIds: Set<number>
}

type KeyT = {
  refreshCount: number
  conditions: string
  phrase: string
  sort: SortStateT
  view: PriceViewT
}

/**
 * Cells save per keystroke, so a sort, a search phrase or a condition would move or drop the pozycja
 * (or the etap's column) under the cursor one keystroke in. The latch holds what the view showed until a
 * deliberate action: a sort pick (the same sort object only while nobody re-picks it), a new phrase, a
 * condition toggle, a price-view switch or `refresh` („Problemy"/„Filtry" opening, „Zapisz kolejność").
 */
export function useViewLatch(input: {
  conditionIds: ReadonlySet<string>
  search: string
  sort: SortStateT
  view: PriceViewT
}): { latch: EditorViewLatchT | null; refresh: () => void } {
  const [refreshCount, setRefreshCount] = useState(0)
  const phrase = input.search.trim()
  const enabled = input.conditionIds.size > 0 || phrase !== '' || input.sort !== null
  const key: KeyT = {
    refreshCount,
    conditions: [...input.conditionIds].sort().join('|'),
    phrase,
    sort: input.sort,
    view: input.view,
  }
  const [latch, setLatch] = useState(() => freshLatch(key))
  const current = sameKey(latch.key, key) ? latch : freshLatch(key)
  if (current !== latch) setLatch(current)
  return {
    latch: enabled ? current.value : null,
    refresh: () => {
      if (enabled) setRefreshCount((count) => count + 1)
    },
  }
}

function freshLatch(key: KeyT): { key: KeyT; value: EditorViewLatchT } {
  return { key, value: { ids: new Set(), rank: new Map(), stageIds: new Set() } }
}

function sameKey(a: KeyT, b: KeyT): boolean {
  return (
    a.refreshCount === b.refreshCount &&
    a.conditions === b.conditions &&
    a.phrase === b.phrase &&
    a.sort === b.sort &&
    a.view === b.view
  )
}
