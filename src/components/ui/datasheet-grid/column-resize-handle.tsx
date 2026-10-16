'use client'

import type { PointerEvent, ReactNode } from 'react'
import { useRef } from 'react'

// We deliberately do NOT change the width live: during the drag we only show a vertical guide
// and commit the width on release, so a drag
// costs one re-layout instead of one per pointermove.

const RESIZE_MIN_PX = 40

type PropsT = {
  colId: string
  minWidth: number
  onGuide: (x: number | null) => void
  onCommit: (id: string, width: number) => void
  children: ReactNode
}

export function ResizableHeader({ colId, minWidth, onGuide, onCommit, children }: PropsT) {
  const drag = useRef<{ x: number; w: number } | null>(null)

  function widthAt(target: HTMLElement): number {
    const cell = target.closest('.dsg-cell-header')
    return cell?.getBoundingClientRect().width ?? minWidth
  }

  function onPointerDown(e: PointerEvent<HTMLElement>) {
    // Don't trigger sort (SortHeader onClick) or the cell's native navigation.
    e.preventDefault()
    e.stopPropagation()
    drag.current = { x: e.clientX, w: widthAt(e.currentTarget) }
    e.currentTarget.setPointerCapture(e.pointerId)
    onGuide(e.clientX)
  }

  function onPointerMove(e: PointerEvent<HTMLElement>) {
    if (!drag.current) return
    onGuide(e.clientX)
  }

  function onPointerUp(e: PointerEvent<HTMLElement>) {
    if (!drag.current) return
    const width = Math.max(RESIZE_MIN_PX, Math.round(drag.current.w + (e.clientX - drag.current.x)))
    drag.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
    onGuide(null)
    onCommit(colId, width)
  }

  // The browser can cancel the gesture (pointercancel) — then no pointerup ever arrives and the
  // guide would hang at the last cursor X until the next drag.
  function abortDrag() {
    if (!drag.current) return
    drag.current = null
    onGuide(null)
  }

  // The wrapper is deliberately NOT position:relative — the handle (absolute) should anchor
  // to .dsg-cell-header (the library's position:absolute), not to the wrapper, so it lands
  // on the REAL cell edge, not on the end of the shrink-wrapped title content.
  return (
    <span className="flex h-full w-full items-center">
      {children}
      <span
        role="separator"
        aria-orientation="vertical"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={abortDrag}
        onLostPointerCapture={abortDrag}
        onClick={(e) => e.stopPropagation()}
        className="hover:bg-primary/40 absolute top-0 -right-1 z-10 h-full w-2 cursor-col-resize"
      />
    </span>
  )
}
