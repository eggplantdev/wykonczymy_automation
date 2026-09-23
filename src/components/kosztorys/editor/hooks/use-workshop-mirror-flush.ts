'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { flushWorkshopPresetAction } from '@/lib/actions/kosztorys-presets'
import { PRESET_MIRROR_IDLE_FLUSH_MS } from '@/lib/constants/preset-mirror'

/**
 * Closes the hole `PRESET_MIRROR_IDLE_FLUSH_MS` describes. Not the autosave — that runs server-side
 * after every mutation — so three moments here and no fourth: a cycle, the tab going away, and
 * leaving the editor.
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

    // The counter test is what makes all three moments safe to fire blind: leaving a szablon nobody
    // touched must not rewrite its jsonb, and an unguarded flush would stamp a fresh modification
    // date on a szablon only ever opened — which is the figure the library sorts by.
    const flushIfChanged = () => {
      if (revisionRef.current === flushedRevision.current) return
      flushedRevision.current = revisionRef.current
      void flushWorkshopPresetAction(templatePresetId)
    }

    const id = setInterval(flushIfChanged, PRESET_MIRROR_IDLE_FLUSH_MS)

    // Closing the tab unmounts nothing and outruns the interval, so the last ≤15 s of edits would
    // never reach the szablon. `visibilitychange` rather than `pagehide`: the page is still alive
    // here, so an ordinary Server Action still goes out — `pagehide` is already teardown and would
    // need `sendBeacon`, which cannot call one. Best-effort by nature, and that is enough: the loss
    // is the library's copy lagging until the szablon is next touched, never the work itself, which
    // every mutation has already persisted.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushIfChanged()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      flushIfChanged()
    }
  }, [templatePresetId, revisionRef])
}
