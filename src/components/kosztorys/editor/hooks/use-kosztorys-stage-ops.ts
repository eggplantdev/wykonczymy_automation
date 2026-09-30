'use client'

import { useRef, useState } from 'react'
import { addStageAction, removeStageAction, updateStageAction } from '@/lib/actions/kosztorys'
import { settleAction } from '@/lib/utils/settle-action'
import { stageKey, stageValueGrossKey, stageValueNetKey } from '@/lib/kosztorys/stage-keys'
import type {
  KosztorysStageT,
  KosztorysV2RowT,
  StagePatchT,
  ToolPlaneT,
} from '@/lib/kosztorys/types'
import type { ActionErrorCodeT, ActionResultT } from '@/types/action'

type ArgsT = {
  investmentId: number
  initialStages: KosztorysStageT[]
  patchRows: (
    match: (row: KosztorysV2RowT) => boolean,
    patch: (row: KosztorysV2RowT) => KosztorysV2RowT,
  ) => void
  dropWidth: (...keys: string[]) => void
  save: (key: string, run: () => Promise<ActionResultT>, onError?: () => void) => void
  // Surfaces a refused action (and reseeds the grid when the refusal means the tree is stale).
  reportFailure: (error: string, code?: ActionErrorCodeT) => void
}

// The etap columns themselves: add/remove one, and the three header edits (label, plane, worker).
// Touches the rows only through `patchRows` and never the undo stack — a stage column is structure,
// not a cell edit.
export function useKosztorysStageOps({
  investmentId,
  initialStages,
  patchRows,
  dropWidth,
  save,
  reportFailure,
}: ArgsT) {
  // Stages live in local state (like `rows`): add/remove optimistically add/drop a column.
  const [stages, setStages] = useState<KosztorysStageT[]>(initialStages)
  // For the stage-rename handler's no-op guard (compares against the fresh label). Writing a ref
  // during render is the deliberate "latest value" pattern; react-hooks/refs forbids it outright.
  const stagesRef = useRef(stages)

  // eslint-disable-next-line react-hooks/refs
  stagesRef.current = stages

  // A new stage adds a `stage_<id>: 0` key to every current row + snapshot (like patchRows for
  // coeffs), so the column renders 0s (not blanks) and the first progress entry diffs correctly.
  async function handleAddStage(plane: ToolPlaneT, workerId: number | null) {
    const res = await settleAction(() => addStageAction(investmentId, plane, workerId))
    if (!res.success) return reportFailure(res.error, res.code)
    const { id, ordinal } = res.data
    setStages((s) => [...s, { id, ordinal, label: null, plane, workerId }])
    patchRows(
      () => true,
      (r) => ({ ...r, [stageKey(id)]: 0 }),
    )
  }

  async function handleRemoveStage(stageId: number) {
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
  }

  // Shared by all three header edits so they inherit the cell edits' revert-on-error discipline.
  // The revert restores the prior value only if nothing newer landed on the field meanwhile (it
  // still reads `value`) — which is what makes a slow rejected write safe to roll back.
  //
  // `saveKey` is passed rather than derived from `field`: it is the debounce identity, so renaming a
  // field must not silently re-bucket in-flight saves.
  function patchStageField<K extends keyof StagePatchT & keyof KosztorysStageT>(
    stageId: number,
    field: K,
    value: StagePatchT[K],
    saveKey: string,
  ) {
    const current = stagesRef.current.find((st) => st.id === stageId)
    if (current && current[field] === value) return
    const prev = current?.[field] ?? null
    const withField = (stage: KosztorysStageT, next: unknown) =>
      ({ ...stage, [field]: next }) as KosztorysStageT
    setStages((s) => s.map((st) => (st.id === stageId ? withField(st, value) : st)))
    save(
      `${saveKey}:${stageId}`,
      () => updateStageAction(stageId, { [field]: value } as StagePatchT),
      () =>
        setStages((s) =>
          s.map((st) => (st.id === stageId && st[field] === value ? withField(st, prev) : st)),
        ),
    )
  }

  // An empty label reverts to null (the header shows the "Etap N" placeholder). The no-op guard in
  // patchStageField earns its keep here: the header's onBlur fires on every focus-out, and it has no
  // diff of its own, unlike item cells via diffRow.
  function handleRenameStage(stageId: number, label: string) {
    const trimmed = label.trim()
    patchStageField(stageId, 'label', trimmed === '' ? null : trimmed, 'stage-label')
  }

  // Fired from the header's onValueChange (an event handler, never inside a state updater). Picking
  // any plane (even the default w_tools) writes it, which is what clears the unconfirmed warning.
  function handleSetStagePlane(stageId: number, plane: ToolPlaneT) {
    patchStageField(stageId, 'plane', plane, 'stage-plane')
  }

  // `null` is a legal target here („Bez przypisania"), unlike plane. No undo push — matching plane,
  // and reassigning back is the exact inverse.
  function handleSetStageWorker(stageId: number, workerId: number | null) {
    patchStageField(stageId, 'workerId', workerId, 'stage-worker')
  }

  return {
    stages,
    handleAddStage,
    handleRemoveStage,
    handleRenameStage,
    handleSetStagePlane,
    handleSetStageWorker,
  }
}
