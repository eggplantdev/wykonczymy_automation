'use client'

import { useRef, type PointerEvent } from 'react'

// The horizontal twin of ResizableHeader: datasheet-grid has no native row resize either. Same
// deal — during the drag only a guide line moves (onGuide = cursor Y), and the height is committed
// on release, so a drag costs one relayout instead of one per pointermove.
//
// It lives in the gutter column because that is the only sticky-left element the grid gives us:
// the handle stays reachable however far the columns are scrolled sideways.

type PropsT = {
  rowId: string
  // The row's resting height — the floor a drag may not go below.
  // A prop rather than an import: this file is a grid primitive and knows nothing about kosztorys.
  minHeight: number
  onGuide: (y: number | null) => void
  onCommit: (rowId: string, height: number) => void
  // A prop because only the caller knows whether this is a row or the header — a tooltip is all the
  // affordance an 8px strip has.
  title: string
}

export function RowResizeHandle({ rowId, minHeight, onGuide, onCommit, title }: PropsT) {
  const drag = useRef<{ y: number; h: number } | null>(null)

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    // The grid resolves a pointerdown to a cell and moves the active cell there; the handle is not
    // a place to start editing. Left button only — a right-click opens the row menu, and a captured
    // drag it never finishes would leave the guide line hanging.
    if (event.button !== 0 || drag.current) return
    event.preventDefault()
    event.stopPropagation()
    const height = event.currentTarget.closest('.dsg-row')?.getBoundingClientRect().height
    drag.current = { y: event.clientY, h: height ?? minHeight }
    event.currentTarget.setPointerCapture(event.pointerId)
    onGuide(event.clientY)
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (!drag.current) return
    onGuide(event.clientY)
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    if (!drag.current) return
    const moved = event.clientY - drag.current.y
    // Floored where it is COMMITTED, not only where it is read: a drag that overshoots upwards would
    // otherwise persist a height the grid silently ignores, and the next reader would have to know
    // the clamp to make sense of the stored number.
    const height = Math.max(minHeight, Math.round(drag.current.h + moved))
    drag.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
    onGuide(null)
    // A press that went nowhere is a click, not a drag: committing the unchanged height would pin
    // the row for merely touching the handle, and nothing in the UI unpins one.
    if (moved !== 0) onCommit(rowId, height)
  }

  // A gesture the browser cancels never delivers pointerup, which would leave the guide hanging at
  // the last cursor Y. A cancelled drag commits nothing — the row keeps the height it had.
  function abortDrag() {
    if (!drag.current) return
    drag.current = null
    onGuide(null)
  }

  return (
    <span
      role="separator"
      aria-orientation="horizontal"
      title={title}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={abortDrag}
      onLostPointerCapture={abortDrag}
      onClick={(event) => event.stopPropagation()}
      // Anchored to .dsg-cell-gutter, which the library positions absolutely.
      className="hover:bg-primary/40 absolute inset-x-0 bottom-0 z-10 h-2 cursor-row-resize"
    />
  )
}
