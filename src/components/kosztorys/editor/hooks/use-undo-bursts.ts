'use client'

import { useEffect, useRef, useState } from 'react'
import {
  coalesceFieldChanges,
  coalesceStageChanges,
  foldRetractions,
  type FieldChangeT,
  type GridBurstT,
  type StageChangeT,
} from '@/lib/kosztorys/undo-coalesce'
import type { UndoCommandT, UndoRedoApiT } from '@/components/kosztorys/editor/hooks/use-undo-redo'
import type { ItemPatchT } from '@/lib/kosztorys/types'

// Longer than the debounced save (500ms) so a burst is captured only once its writes are scheduled.
const UNDO_COALESCE_MS = 700

type ArgsT = Pick<UndoRedoApiT, 'push' | 'amendTop'> & {
  reverse: (fields: FieldChangeT[], stages: StageChangeT[], dir: 'undo' | 'redo') => void
}

export function useUndoBursts({ push, amendTop, reverse }: ArgsT) {
  const pendingFields = useRef<FieldChangeT[]>([])
  const pendingStages = useRef<StageChangeT[]>([])
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [hasPendingBurst, setHasPendingBurst] = useState(false)

  const lastGridCommand = useRef<{ command: UndoCommandT; burst: GridBurstT } | null>(null)

  function gridCommand({ fields, stages }: GridBurstT): UndoCommandT | null {
    if (fields.length === 0 && stages.length === 0) return null
    return {
      label: 'Edycja',
      undo: () => reverse(fields, stages, 'undo'),
      redo: () => reverse(fields, stages, 'redo'),
      touchedIds: [...new Set([...fields.map((c) => c.id), ...stages.map((c) => c.id)])],
    }
  }

  function flushUndoBuffer() {
    if (flushTimer.current) {
      clearTimeout(flushTimer.current)
      flushTimer.current = null
    }
    let burst: GridBurstT = {
      fields: coalesceFieldChanges(pendingFields.current),
      stages: coalesceStageChanges(pendingStages.current),
    }
    pendingFields.current = []
    pendingStages.current = []
    setHasPendingBurst(false)

    const previous = lastGridCommand.current
    if (previous) {
      const folded = foldRetractions(previous.burst, burst)
      if (folded.retracted) {
        const trimmed = gridCommand(folded.previous)
        if (amendTop(previous.command, trimmed)) {
          lastGridCommand.current = trimmed ? { command: trimmed, burst: folded.previous } : null
          burst = folded.next
        }
      }
    }

    const command = gridCommand(burst)
    if (!command) return
    push(command)
    lastGridCommand.current = { command, burst }
  }

  function bufferBurst(fieldChanges: FieldChangeT[], stageChanges: StageChangeT[]) {
    if (fieldChanges.length === 0 && stageChanges.length === 0) return
    pendingFields.current.push(...fieldChanges)
    pendingStages.current.push(...stageChanges)
    setHasPendingBurst(true)
    if (flushTimer.current) clearTimeout(flushTimer.current)
    flushTimer.current = setTimeout(flushUndoBuffer, UNDO_COALESCE_MS)
  }

  function clearBurstIfEmpty() {
    if (pendingFields.current.length > 0 || pendingStages.current.length > 0) return
    if (flushTimer.current) {
      clearTimeout(flushTimer.current)
      flushTimer.current = null
    }
    setHasPendingBurst(false)
  }

  function dropPendingField(id: number, field: keyof ItemPatchT) {
    pendingFields.current = pendingFields.current.filter((c) => !(c.id === id && c.field === field))
    clearBurstIfEmpty()
  }

  function dropPendingStage(id: number, stageId: number) {
    pendingStages.current = pendingStages.current.filter(
      (c) => !(c.id === id && c.stageId === stageId),
    )
    clearBurstIfEmpty()
  }

  useEffect(() => {
    return () => {
      if (flushTimer.current) clearTimeout(flushTimer.current)
    }
  }, [])

  // Flush any buffering grid edit first, so a burst typed just before keeps its LIFO place on the stack.
  function pushCommand(cmd: UndoCommandT) {
    flushUndoBuffer()
    push(cmd)
  }

  function pushReversible<T>(
    label: string,
    apply: (state: T) => void,
    before: T,
    after: T,
    touchedIds?: number[],
  ) {
    pushCommand({ label, undo: () => apply(before), redo: () => apply(after), touchedIds })
  }

  return {
    hasPendingBurst,
    flushUndoBuffer,
    bufferBurst,
    dropPendingField,
    dropPendingStage,
    pushCommand,
    pushReversible,
  }
}

export type UndoBurstsT = ReturnType<typeof useUndoBursts>
