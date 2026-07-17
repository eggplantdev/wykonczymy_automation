import type { ItemPatchT } from '@/lib/kosztorys/types'

// Undo/redo command payloads captured at the grid write seams, plus the burst-coalescing that turns
// a stream of per-keystroke onChange batches into one undo entry.
//
// react-datasheet-grid text cells run with continuousUpdates:true, so every keystroke fires a grid
// onChange. Pushing an undo command per onChange would make undo per-character (a 20-char edit = 20
// steps, enough to overflow the 50-deep stack) and would leave dead net-zero entries behind a
// type-then-revert. Coalescing collapses a burst on each (row, field) / (row×stage) into a single
// change whose `before` is the first value seen and `after` the last, dropping any whose net is zero.

export type FieldChangeT = { id: number; field: keyof ItemPatchT; before: unknown; after: unknown }
export type StageChangeT = { id: number; stageId: number; before: number; after: number }

function coalesceBy<T extends { before: unknown; after: unknown }>(
  seq: readonly T[],
  keyOf: (change: T) => string,
): T[] {
  const byKey = new Map<string, T>()
  for (const c of seq) {
    const key = keyOf(c)
    const merged = byKey.get(key)
    if (merged) merged.after = c.after
    else byKey.set(key, { ...c })
  }
  return [...byKey.values()].filter((c) => c.before !== c.after)
}

export const coalesceFieldChanges = (seq: readonly FieldChangeT[]): FieldChangeT[] =>
  coalesceBy(seq, (c) => `${c.id}:${String(c.field)}`)

export const coalesceStageChanges = (seq: readonly StageChangeT[]): StageChangeT[] =>
  coalesceBy(seq, (c) => `${c.id}:${c.stageId}`)
