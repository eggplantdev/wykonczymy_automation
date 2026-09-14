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
 * Cancels the browser's default handling of dropped files for as long as the calling dropzone is
 * mounted, and reports whether a file is currently over the window.
 *
 * Without the cancel, a file released anywhere but a dropzone is handled by the document itself and
 * the browser navigates to it — discarding whatever the user had typed into the open dialog. Mounted
 * by the dropzones rather than by a layout so the listeners exist exactly while there is something
 * to aim at, and never inside the Payload admin, whose own dropzone we don't control.
 *
 * Several dropzones on screen means several copies of these listeners on one event, so the guard
 * does nothing but `preventDefault` — reading or consuming the file here would run N times.
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

    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleDrop)
    window.addEventListener('dragend', handleDragEnd)
    return () => {
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('drop', handleDrop)
      window.removeEventListener('dragend', handleDragEnd)
    }
  }, [])

  return isFileDragActive
}
