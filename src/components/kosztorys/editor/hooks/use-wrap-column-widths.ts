'use client'

import { useCallback, useEffect, useState, type RefObject } from 'react'
import { WRAPPING_COLUMN_IDS, wrapColumnClass } from '@/lib/kosztorys/row-content-lines'
import type { WrappingColumnIdT } from '@/lib/kosztorys/row-content-lines'

// A cell's 1px right border plus ReadOnlyCellText's px-2, i.e. everything between the cell's edge
// and the first glyph.
const CELL_TEXT_CHROME_PX = 17

// text-sm, the class every cell's text carries. Composed rather than read off a rendered cell so
// the first measurement doesn't have to wait for one to exist.
const CELL_FONT_SIZE = '14px'
const CELL_FONT_WEIGHT = '400'

export type WrapWidthsT = {
  widths: Partial<Record<WrappingColumnIdT, number>>
  font: string
}

const EMPTY: WrapWidthsT = { widths: {}, font: `${CELL_FONT_WEIGHT} ${CELL_FONT_SIZE} sans-serif` }

/**
 * Rendered text width of each wrapping column, remeasured whenever the grid's box changes — a
 * window resize, the client dragging a column edge, or the webfont finally arriving.
 *
 * A column scrolled out of the horizontal window has no header cell in the DOM at all, so a width
 * once measured is KEPT rather than dropped: a missing measurement would otherwise read as "this
 * text needs one line" and flatten every row the moment someone scrolls sideways.
 */
export function useWrapColumnWidths(
  containerRef: RefObject<HTMLElement | null>,
  columnIds: readonly (string | undefined)[],
): WrapWidthsT {
  const [measured, setMeasured] = useState<WrapWidthsT>(EMPTY)

  const measure = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const family = window.getComputedStyle(container).fontFamily
    const font = `${CELL_FONT_WEIGHT} ${CELL_FONT_SIZE} ${family}`
    setMeasured((prev) => {
      const widths = { ...prev.widths }
      for (const id of WRAPPING_COLUMN_IDS) {
        // A column the current view doesn't render at all keeps no width — that is what stops a
        // column the client cannot see from making their rows taller.
        if (!columnIds.includes(id)) {
          delete widths[id]
          continue
        }
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

  // Deliberately NOT a ResizeObserver on the grid: useElementHeight documents that observing this
  // container deadlocks against dsg's own resize detector. What moves a column edge is a window
  // resize, a drag or a toggle (both rebuild `columnIds`) and the first layout — rAF because dsg
  // sizes its columns from its own measurement a frame after mount. `fonts.ready` is the fourth:
  // the family name is the same before and after the file loads, so the first measurement can
  // silently be taken in the fallback's metrics and would never be revisited.
  useEffect(() => {
    const frame = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    let live = true
    void document.fonts?.ready.then(() => {
      if (live) measure()
    })
    return () => {
      live = false
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
    }
  }, [measure])

  return measured
}

function sameWidths(a: WrapWidthsT['widths'], b: WrapWidthsT['widths']): boolean {
  return WRAPPING_COLUMN_IDS.every((id) => a[id] === b[id])
}
