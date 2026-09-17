'use client'

import { useEffect, useRef, useState } from 'react'

/** Weak state: a file is over the window, this zone is a possible target but not the active one. */
export const FILE_DRAG_ARMED_CLASS = 'ring-neon-cyan/40 ring-1'
/** Strong state: the cursor is over this zone, releasing here will drop the file. */
export const FILE_DRAG_OVER_CLASS = 'ring-neon-cyan ring-2'

function isFileDrag(e: DragEvent): boolean {
  return e.dataTransfer?.types.includes('Files') ?? false
}

/**
 * Cancels the browser's default drop handling (else a stray drop navigates the tab) while mounted,
 * and reports whether a file is over the window. Per-dropzone, not per-layout, so never active
 * inside the Payload admin. Only calls `preventDefault` — several dropzones share this listener.
 */
export function useWindowFileDrag(): boolean {
  const [isFileDragActive, setIsFileDragActive] = useState(false)
  // dragenter/dragleave fire on every element boundary crossed inside the page, so a plain boolean
  // would flicker; only the outermost enter/leave pair means the file entered or left the window.
  const depthRef = useRef(0)

  useEffect(() => {
    function setDepth(next: number) {
      depthRef.current = next
      setIsFileDragActive(next > 0)
    }

    function handleDragOver(e: DragEvent) {
      if (!isFileDrag(e)) return
      e.preventDefault()
    }

    function handleDragEnter(e: DragEvent) {
      if (!isFileDrag(e)) return
      setDepth(depthRef.current + 1)
    }

    function handleDragLeave(e: DragEvent) {
      if (!isFileDrag(e)) return
      setDepth(Math.max(0, depthRef.current - 1))
    }

    function handleDrop(e: DragEvent) {
      if (!isFileDrag(e)) return
      e.preventDefault()
      setDepth(0)
    }

    function handleDragEnd() {
      setDepth(0)
    }

    // Capture, not bubble: a dropzone's own `document` handler calls `stopPropagation`, which would
    // otherwise stop this before it reaches `window` and leave the depth counter stuck.
    const opts = { capture: true } as const
    window.addEventListener('dragover', handleDragOver, opts)
    window.addEventListener('dragenter', handleDragEnter, opts)
    window.addEventListener('dragleave', handleDragLeave, opts)
    window.addEventListener('drop', handleDrop, opts)
    window.addEventListener('dragend', handleDragEnd, opts)
    return () => {
      window.removeEventListener('dragover', handleDragOver, opts)
      window.removeEventListener('dragenter', handleDragEnter, opts)
      window.removeEventListener('dragleave', handleDragLeave, opts)
      window.removeEventListener('drop', handleDrop, opts)
      window.removeEventListener('dragend', handleDragEnd, opts)
    }
  }, [])

  return isFileDragActive
}
