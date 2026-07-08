'use client'

import { useCallback, useRef, useState } from 'react'

// View-filling height: from the element's top edge to the bottom of the window (minus gap).
// Computed from `window.innerHeight - rect.top`, NOT from the element's own clientHeight —
// the top position depends on the navbar/header ABOVE the grid, which the grid doesn't change, so
// the value is stable. No ResizeObserver: measuring the grid container's clientHeight
// fell into a loop with react-datasheet-grid's internal resize detector (constant "flickering",
// thousands of Issues/s in DevTools). Measure only on mount and window resize; floor + gap so
// the grid is slightly shorter than the available space → no ancestor scrollbar → no oscillation.
export function useElementHeight(
  gap = 8,
  fallback = 600,
): [(node: HTMLElement | null) => void, number] {
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
      // rAF: measure after the layout settles, not during commit.
      requestAnimationFrame(measure)
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    },
    [measure],
  )

  return [ref, height]
}
