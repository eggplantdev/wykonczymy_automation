'use client'

import { useRef, type PointerEvent } from 'react'

type PropsT = {
  rowId: string
  minHeight: number
  onGuide: (y: number | null) => void
  onCommit: (rowId: string, height: number) => void
  title: string
}

export function RowResizeHandle({ rowId, minHeight, onGuide, onCommit, title }: PropsT) {
  const drag = useRef<{ y: number; h: number } | null>(null)

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    // Left button only — a right-click opens the row menu, and a captured drag it never finishes leaves the guide hanging.
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
    // Floored where it is COMMITTED: otherwise an overshoot persists a height the grid silently ignores.
    const height = Math.max(minHeight, Math.round(drag.current.h + moved))
    drag.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
    onGuide(null)
    // A press that went nowhere is a click, not a drag: committing the unchanged height would pin
    // the row for merely touching the handle, and nothing in the UI unpins one.
    if (moved !== 0) onCommit(rowId, height)
  }

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
      className="hover:bg-primary/40 absolute inset-x-0 bottom-0 z-10 h-2 cursor-row-resize"
    />
  )
}
