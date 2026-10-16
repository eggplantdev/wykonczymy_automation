'use client'

import { useRef, useState } from 'react'
import {
  addStageAction,
  removeStageAction,
  updateStageAction,
  updateStageSplitAction,
} from '@/lib/actions/kosztorys'
import { settleAction } from '@/lib/utils/settle-action'
import { stageKey, stageValueGrossKey, stageValueNetKey } from '@/lib/kosztorys/stage-keys'
import type {
  KosztorysStageT,
  KosztorysV2RowT,
  StagePatchT,
  StageSplitT,
  ToolPlaneT,
} from '@/lib/kosztorys/types'
import type { ActionErrorCodeT, ActionResultT } from '@/types/action'
import type { StageOpsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'

type ArgsT = {
  investmentId: number
  initialStages: KosztorysStageT[]
  patchRows: (
    match: (row: KosztorysV2RowT) => boolean,
    patch: (row: KosztorysV2RowT) => KosztorysV2RowT,
  ) => void
  dropWidth: (...keys: string[]) => void
  save: (key: string, run: () => Promise<ActionResultT>, onError?: () => void) => void
  reportFailure: (error: string, code?: ActionErrorCodeT) => void
}

export function useKosztorysStageOps({
  investmentId,
  initialStages,
  patchRows,
  dropWidth,
  save,
  reportFailure,
}: ArgsT) {
  const [stages, setStages] = useState<KosztorysStageT[]>(initialStages)
  const stagesRef = useRef(stages)

  // eslint-disable-next-line react-hooks/refs
  stagesRef.current = stages

  // so the column renders 0s (not blanks) and the first progress entry diffs correctly.
  async function handleAddStage(plane: ToolPlaneT, split: StageSplitT | null) {
    const res = await settleAction(() => addStageAction(investmentId, plane, split))
    if (!res.success) return reportFailure(res.error, res.code)
    const { id, ordinal } = res.data
    adoptStage({ id, ordinal, label: null, plane, split, completed: false })
  }

  function adoptStage(stage: KosztorysStageT) {
    setStages((s) => [...s, stage])
    patchRows(
      () => true,
      (r) => ({ ...r, [stageKey(stage.id)]: 0 }),
    )
  }

  // The revert restores the prior value only if nothing newer landed on the field meanwhile (it
  // still reads `value`) — which is what makes a slow rejected write safe to roll back.
  function patchStageField<K extends keyof KosztorysStageT>(
    stageId: number,
    field: K,
    value: KosztorysStageT[K],
    saveKey: string,
    write?: () => ReturnType<typeof updateStageAction>,
  ) {
    const current = stagesRef.current.find((st) => st.id === stageId)
    if (current && current[field] === value) return
    const prev = current?.[field] ?? null
    const withField = (stage: KosztorysStageT, next: unknown) =>
      ({ ...stage, [field]: next }) as KosztorysStageT
    setStages((s) => s.map((st) => (st.id === stageId ? withField(st, value) : st)))
    save(
      `${saveKey}:${stageId}`,
      write ?? (() => updateStageAction(stageId, { [field]: value } as StagePatchT)),
      () =>
        setStages((s) =>
          s.map((st) => (st.id === stageId && st[field] === value ? withField(st, prev) : st)),
        ),
    )
  }

  const stageOps: StageOpsT = {
    async remove(stageId) {
      const res = await settleAction(() => removeStageAction(stageId))
      if (!res.success) return reportFailure(res.error, res.code)
      setStages((s) => s.filter((st) => st.id !== stageId))
      const key = stageKey(stageId)
      dropWidth(key, stageValueNetKey(stageId), stageValueGrossKey(stageId))
      patchRows(
        () => true,
        (r) => {
          const next = { ...r }
          delete next[key]
          return next
        },
      )
    },
    rename(stageId, label) {
      const trimmed = label.trim()
      patchStageField(stageId, 'label', trimmed === '' ? null : trimmed, 'stage-label')
    },
    // Picking any plane (even the default w_tools) writes it, which is what clears the unconfirmed
    // warning.
    setPlane(stageId, plane) {
      patchStageField(stageId, 'plane', plane, 'stage-plane')
    },
    setCompleted(stageId, completed) {
      patchStageField(stageId, 'completed', completed, 'stage-completed')
    },
    setSplit(stageId, split) {
      patchStageField(stageId, 'split', split, 'stage-split', () =>
        updateStageSplitAction(stageId, split),
      )
    },
  }

  return {
    stages,
    adoptStage,
    handleAddStage,
    stageOps,
  }
}
