import { itemFieldLane, stageLane } from '@/lib/kosztorys/save-lanes'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import type { FieldChangeT, StageChangeT } from '@/lib/kosztorys/undo-coalesce'
import type { ItemPatchT } from '@/lib/kosztorys/types'

export type ReversalDirT = 'undo' | 'redo'

const pick = <T>(change: { before: T; after: T }, dir: ReversalDirT) =>
  dir === 'undo' ? change.before : change.after

const restoreOf = <T>(change: { before: T; after: T }, dir: ReversalDirT) =>
  dir === 'undo' ? change.after : change.before

export function buildReversalPatches(
  fields: readonly FieldChangeT[],
  stages: readonly StageChangeT[],
  dir: ReversalDirT,
): Map<number, Record<string, unknown>> {
  const patchById = new Map<number, Record<string, unknown>>()
  for (const c of fields) {
    const patch = patchById.get(c.id) ?? {}
    patch[c.field as string] = pick(c, dir)
    patchById.set(c.id, patch)
  }
  for (const c of stages) {
    const patch = patchById.get(c.id) ?? {}
    patch[stageKey(c.stageId)] = pick(c, dir)
    patchById.set(c.id, patch)
  }
  return patchById
}

// `lane` MUST match the lane the forward autosave used for the same cell, or an undo can overtake
// the save it is undoing.
export type ReversalWriteT =
  | {
      kind: 'field'
      lane: string
      id: number
      field: keyof ItemPatchT
      value: unknown
      restore: unknown
    }
  | {
      kind: 'stage'
      lane: string
      id: number
      stageId: number
      value: number
      restore: number
    }

export function planReversalWrites(
  fields: readonly FieldChangeT[],
  stages: readonly StageChangeT[],
  dir: ReversalDirT,
): ReversalWriteT[] {
  return [
    ...fields.map(
      (c): ReversalWriteT => ({
        kind: 'field',
        lane: itemFieldLane(c.id, c.field),
        id: c.id,
        field: c.field,
        value: pick(c, dir),
        restore: restoreOf(c, dir),
      }),
    ),
    ...stages.map(
      (c): ReversalWriteT => ({
        kind: 'stage',
        lane: stageLane(c.id, c.stageId),
        id: c.id,
        stageId: c.stageId,
        value: pick(c, dir),
        restore: restoreOf(c, dir),
      }),
    ),
  ]
}
