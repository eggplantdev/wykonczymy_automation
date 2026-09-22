'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { flushWorkshopPresetAction } from '@/lib/actions/kosztorys-presets'
import { PRESET_MIRROR_IDLE_FLUSH_MS } from '@/lib/constants/preset-mirror'

/**
 * Closes the hole `PRESET_MIRROR_IDLE_FLUSH_MS` describes. Not the autosave — that runs server-side
 * after every mutation — so two moments here and no third: a cycle, and leaving the editor.
 *
 * `revisionRef` is the same counter the autosnapshots use — a tick with no change does nothing, so
 * an open, untouched tab never rewrites the jsonb. The counter lags by the undo-coalescing window
 * (≤700 ms) and cannot see mutations from outside the stack; harmless, because the next tick picks
 * them up and the flush on exit reads the counter's latest value.
 */
export function useWorkshopMirrorFlush(
  templatePresetId: number | undefined,
  revisionRef: RefObject<number>,
): void {
  const flushedRevision = useRef(0)

  useEffect(() => {
    if (templatePresetId == null) return

    flushedRevision.current = revisionRef.current
    const id = setInterval(() => {
      if (revisionRef.current === flushedRevision.current) return
      flushedRevision.current = revisionRef.current
      void flushWorkshopPresetAction(templatePresetId)
    }, PRESET_MIRROR_IDLE_FLUSH_MS)

    return () => {
      clearInterval(id)
      // Same counter test as the tick: leaving a szablon nobody touched must not rewrite its jsonb,
      // and this fires on every navigation away — the one moment a workbench is guaranteed to be
      // torn down. Unguarded it would stamp a new modification date on a szablon only ever opened,
      // which is exactly the figure the library sorts by.
      if (revisionRef.current === flushedRevision.current) return
      void flushWorkshopPresetAction(templatePresetId)
    }
  }, [templatePresetId, revisionRef])
}
