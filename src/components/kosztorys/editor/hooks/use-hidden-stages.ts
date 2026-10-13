'use client'

import { createJsonMapStore, dropKeys, useJsonMap } from '@/hooks/create-json-map-store'
import { usePersistedFlag } from '@/hooks/use-persisted-value'
import type { KosztorysStageT } from '@/lib/kosztorys/types'

// Which etapy the reader put away, per investment — the per-etap half of the „Etapy — …" picker
// ticks, which hide one AXIS across every etap. Kept out of useHiddenColumns' map on purpose
// (stage-keys.ts): that map is global, and etap ids are not. Every write keeps only the ids of
// etapy that still exist, so a deleted etap's entry cannot outlive it and resurface on a reissued id.
const store = createJsonMapStore<number[]>('table-columns:kosztorys-stages')
// „Ukryj zakończone" is a reading habit, not a choice about one kosztorys, so it is global — and it
// never writes the ticks above, which is what lets switching it off restore exactly what was there.
const HIDE_COMPLETED_KEY = 'table-columns:kosztorys-hide-completed-stages'
const HIDE_COMPLETED_WORDS = ['hide', 'show'] as const

// A corrupt entry (non-array) reads as "nothing hidden" rather than throwing in render.
function hiddenIn(map: Record<string, number[]>, key: string): Set<number> {
  const stored = map[key]
  return new Set(Array.isArray(stored) ? stored : [])
}

export function useHiddenStages(
  investmentId: number,
  stages: KosztorysStageT[],
): {
  // The etap's own tick only — what its row in the menu shows.
  isStageHidden: (stageId: number) => boolean
  // Off the grid for either reason: its tick, or „Ukryj zakończone" on a zakończony etap.
  isStageOff: (stageId: number) => boolean
  hideCompleted: boolean
  setHideCompleted: (hide: boolean) => void
  toggleStage: (stageId: number) => void
  setStagesHidden: (ids: number[], hidden: boolean) => void
} {
  const key = String(investmentId)
  const hidden = hiddenIn(useJsonMap(store), key)
  const [hideCompleted, setHideCompleted] = usePersistedFlag(
    HIDE_COMPLETED_KEY,
    HIDE_COMPLETED_WORDS,
    false,
  )
  const stageIds = stages.map((stage) => stage.id)
  const completedIds = new Set(stages.filter((stage) => stage.completed).map((stage) => stage.id))

  // Against the freshly-read map, so two toggles in one tick don't revert each other.
  function write(next: (prev: Set<number>) => Set<number>) {
    store.update((prev) => {
      const after = next(hiddenIn(prev, key))
      const live = stageIds.filter((id) => after.has(id))
      return live.length === 0 ? dropKeys(prev, [key]) : { ...prev, [key]: live }
    })
  }

  function toggleStage(stageId: number) {
    write((prev) => {
      if (prev.has(stageId)) prev.delete(stageId)
      else prev.add(stageId)
      return prev
    })
  }

  // Over the ids the caller lists, not every etap: a subcontractor view lists only its crew's etapy,
  // and „Pokaż wszystkie" there must not reach the other crew's.
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
    isStageHidden: (stageId) => hidden.has(stageId),
    isStageOff: (stageId) => hidden.has(stageId) || (hideCompleted && completedIds.has(stageId)),
    hideCompleted,
    setHideCompleted,
    toggleStage,
    setStagesHidden,
  }
}
