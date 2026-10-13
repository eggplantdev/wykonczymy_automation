'use client'

import { createJsonMapStore, dropKeys, useJsonMap } from '@/hooks/create-json-map-store'

// Which etapy the reader put away, per investment — the per-etap half of the „Etapy — …" picker
// ticks, which hide one AXIS across every etap. Kept out of useHiddenColumns' map on purpose
// (stage-keys.ts): that map is global, and etap ids are not. Every write keeps only the ids of
// etapy that still exist, so a deleted etap's entry cannot outlive it and resurface on a reissued id.
const store = createJsonMapStore<number[]>('table-columns:kosztorys-stages')

// A corrupt entry (non-array) reads as "nothing hidden" rather than throwing in render.
function hiddenIn(map: Record<string, number[]>, key: string): Set<number> {
  const stored = map[key]
  return new Set(Array.isArray(stored) ? stored : [])
}

export function useHiddenStages(
  investmentId: number,
  stageIds: number[],
): {
  isStageHidden: (stageId: number) => boolean
  toggleStage: (stageId: number) => void
  setStagesHidden: (ids: number[], hidden: boolean) => void
} {
  const key = String(investmentId)
  const hidden = hiddenIn(useJsonMap(store), key)

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

  return { isStageHidden: (stageId) => hidden.has(stageId), toggleStage, setStagesHidden }
}
