'use client'

import { createJsonMapStore, dropKeys, useJsonMap } from '@/hooks/create-json-map-store'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import { toggleInSet } from '@/lib/utils/toggle-in-set'

const store = createJsonMapStore<number[]>('table-columns:kosztorys-stages')

function hiddenIn(map: Record<string, number[]>, key: string): Set<number> {
  const stored = map[key]
  return new Set(Array.isArray(stored) ? stored : [])
}

export function useHiddenStages(
  investmentId: number,
  stages: KosztorysStageT[],
): {
  isStageOff: (stageId: number) => boolean
  toggleStage: (stageId: number) => void
  setStagesHidden: (ids: number[], hidden: boolean) => void
} {
  const key = String(investmentId)
  const hidden = hiddenIn(useJsonMap(store), key)
  const stageIds = stages.map((stage) => stage.id)

  // Against the freshly-read map, so two toggles in one tick don't revert each other.
  function write(next: (prev: Set<number>) => Set<number>) {
    store.update((prev) => {
      const after = next(hiddenIn(prev, key))
      const live = stageIds.filter((id) => after.has(id))
      return live.length === 0 ? dropKeys(prev, [key]) : { ...prev, [key]: live }
    })
  }

  function toggleStage(stageId: number) {
    write((prev) => toggleInSet(prev, stageId))
  }

  // Over the ids the caller lists, not every etap: a subcontractor view lists only its crew's etapy,
  // and „Zakończone" there must not reach the other crew's.
  function setStagesHidden(ids: number[], hide: boolean) {
    write((prev) => {
      for (const id of ids) {
        if (hide) prev.add(id)
        else prev.delete(id)
      }
      return prev
    })
  }

  return {
    isStageOff: (stageId) => hidden.has(stageId),
    toggleStage,
    setStagesHidden,
  }
}
