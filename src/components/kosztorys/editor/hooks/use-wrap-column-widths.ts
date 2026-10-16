'use client'

import { useCallback, useEffect, useState, type RefObject } from 'react'
import { wrapColumnClass, type ColumnWidthsT } from '@/lib/kosztorys/row-content-lines'
import type { GridTextSizeT } from '@/components/kosztorys/editor/hooks/use-grid-text-size'

// A cell's 1px right border plus ReadOnlyCellText's px-2, i.e. everything between the cell's edge
// and the first glyph.
const CELL_TEXT_CHROME_PX = 17

const CELL_TEXT_SELECTOR = '.grid-cell-text'
const CELL_FONT_WEIGHT = '400'

export type WrapWidthsT = {
  widths: ColumnWidthsT
  font: string
}

const EMPTY: WrapWidthsT = { widths: {}, font: `${CELL_FONT_WEIGHT} 14px sans-serif` }

/**
 * A column scrolled out of the horizontal window has no header cell in the DOM at all, so a width
 * once measured is KEPT rather than dropped: a missing measurement would otherwise read as "this
 * text needs one line" and flatten every row the moment someone scrolls sideways.
 */
export function useWrapColumnWidths(
  containerRef: RefObject<HTMLElement | null>,
  columnIds: readonly string[],
  textSize: GridTextSizeT,
): WrapWidthsT {
  const [measured, setMeasured] = useState<WrapWidthsT>(EMPTY)

  const measure = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const cellText = container.querySelector(CELL_TEXT_SELECTOR)
    const cellStyle = cellText ? window.getComputedStyle(cellText) : undefined
    setMeasured((prev) => {
      const font = cellStyle
        ? `${CELL_FONT_WEIGHT} ${cellStyle.fontSize} ${cellStyle.fontFamily}`
        : prev.font
      const widths: Record<string, number> = { ...prev.widths }
      // A column the current view doesn't render at all keeps no width — that is what stops a
      // column the client cannot see from making their rows taller.
      for (const id of Object.keys(widths)) {
        if (!columnIds.includes(id)) delete widths[id]
      }
      for (const id of columnIds) {
        const cell = container.querySelector(
          `.dsg-row-header .dsg-cell-header.${wrapColumnClass(id)}`,
        )
        if (!cell) continue
        widths[id] = cell.getBoundingClientRect().width - CELL_TEXT_CHROME_PX
      }
      // Same object every time nothing moved: this value keys the height cache's invalidation, so a
      // fresh identity per resize tick would reset every row's height for nothing.
      return prev.font === font && sameWidths(prev.widths, widths) ? prev : { widths, font }
    })
  }, [containerRef, columnIds])

  // Deliberately NOT a ResizeObserver on the grid: observing this
  // container deadlocks against dsg's own resize detector.
  useEffect(() => {
    const frame = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    const container = containerRef.current
    let pending = 0
    const schedule = () => {
      cancelAnimationFrame(pending)
      pending = requestAnimationFrame(measure)
    }
    container?.addEventListener('scroll', schedule, { capture: true, passive: true })
    let live = true
    void document.fonts?.ready.then(() => {
      if (live) measure()
    })
    return () => {
      live = false
      cancelAnimationFrame(frame)
      cancelAnimationFrame(pending)
      window.removeEventListener('resize', measure)
      container?.removeEventListener('scroll', schedule, true)
    }
  }, [measure, containerRef, textSize])

  return measured
}

function sameWidths(a: ColumnWidthsT, b: ColumnWidthsT): boolean {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((id) => a[id] === b[id])
}
