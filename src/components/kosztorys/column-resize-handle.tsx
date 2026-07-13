'use client'

import type { PointerEvent, ReactNode } from 'react'
import { useRef } from 'react'

// Handle for dragging the right edge of a column header. datasheet-grid has no native
// resize, and its internal memo won't recompute widths without a remount —
// so we do NOT change the width live. During the drag we show a vertical guide (onGuide = the
// cursor's X coordinate) and commit the actual width on release (onCommit), which remounts the grid
// with the new width. The starting width is measured from the header cell's DOM
// (closest('.dsg-cell-header')) — this also works for columns not yet pinned.

// Hard floor for a USER-dragged width — deliberately below every column's design `minWidth` so
// shrinking isn't blocked at the design min (EX-424). Small but non-zero so a column can't become a
// 0-width, unhittable sliver. The design `minWidth` still governs the grid's own flex layout for
// columns the user hasn't pinned.
const RESIZE_MIN_PX = 40

type PropsT = {
  colId: string
  minWidth: number
  onGuide: (x: number | null) => void // cursor X for the guide (null = end of drag)
  onCommit: (id: string, width: number) => void // on release → persist + remount
  children: ReactNode
}

export function ResizableHeader({ colId, minWidth, onGuide, onCommit, children }: PropsT) {
  // startX = cursor position at pointerdown; startW = measured cell width.
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
        onClick={(e) => e.stopPropagation()}
        className="hover:bg-primary/40 absolute top-0 -right-1 z-10 h-full w-2 cursor-col-resize"
      />
    </span>
  )
}
