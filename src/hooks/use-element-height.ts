'use client'

import { useCallback, useRef, useState, type RefObject } from 'react'

// No ResizeObserver: measuring the grid container's clientHeight fell into a loop with
// react-datasheet-grid's internal resize detector.
export function useElementHeight(
  gap = 8,
  fallback = 600,
): [(node: HTMLElement | null) => void, number, RefObject<HTMLElement | null>] {
  const [height, setHeight] = useState(fallback)
  const nodeRef = useRef<HTMLElement | null>(null)

  const measure = useCallback(() => {
    const node = nodeRef.current
    if (!node) return
    const top = node.getBoundingClientRect().top
    const next = Math.max(240, Math.floor(window.innerHeight - top - gap))
    setHeight((prev) => (prev === next ? prev : next))
  }, [gap])

  const ref = useCallback(
    (node: HTMLElement | null) => {
      nodeRef.current = node
      if (!node) return
      const frame = requestAnimationFrame(measure)
      window.addEventListener('resize', measure)
      // React 19 calls this cleanup INSTEAD of `ref(null)`, so clearing the node here is the only
      // thing that stops a second reader (the grid measures its columns off it) from holding a
      // detached element.
      return () => {
        nodeRef.current = null
        cancelAnimationFrame(frame)
        window.removeEventListener('resize', measure)
      }
    },
    [measure],
  )

  return [ref, height, nodeRef]
}
