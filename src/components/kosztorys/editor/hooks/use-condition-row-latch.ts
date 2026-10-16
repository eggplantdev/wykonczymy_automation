'use client'

import { useState } from 'react'

/**
 * A condition stops matching the moment its problem is fixed, so without a latch the row leaves the
 * grid one keystroke in.
 */
export function useConditionRowLatch(
  engagedConditionIds: ReadonlySet<string>,
  enabled: boolean,
): { latch: { ids: Set<number> } | null; refresh: () => void } {
  const [refreshCount, setRefreshCount] = useState(0)
  const key = `${refreshCount}:${[...engagedConditionIds].sort().join('|')}`
  const [latch, setLatch] = useState<{ key: string; ids: Set<number> }>(() => ({
    key,
    ids: new Set(),
  }))
  const current = latch.key === key ? latch : { key, ids: new Set<number>() }
  if (current !== latch) setLatch(current)
  return { latch: enabled ? current : null, refresh: () => setRefreshCount((count) => count + 1) }
}
