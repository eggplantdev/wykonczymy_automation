'use client'

import * as Collapsible from '@radix-ui/react-collapsible'
import { useRef, useState, type PointerEvent, type ReactNode, type TransitionEvent } from 'react'
import { useTotalsPanelOpen } from '@/components/kosztorys/summary/hooks/use-totals-panel-open'
import { useTotalsPanelHeight } from '@/components/kosztorys/summary/hooks/use-totals-panel-height'
import { ChevronDown } from 'lucide-react'
import { EdgeHandlePill } from '@/components/ui/edge-handle-pill'
import {
  FULL_PANEL_FRACTION,
  clampFraction,
  panelTop,
  snapPanelFraction,
} from '@/lib/kosztorys/totals-panel-height'
import { cn } from '@/lib/utils/cn'

// Pointer travel under this is a click, not a drag — a click drifts a pixel or two.
const CLICK_SLOP_PX = 3

// `hasRows` is required on purpose: it picks which localStorage key this panel and its toggle bind
// to, so a call site that forgot it would silently drive a different key than the button next to it.
// `availableHeight` is the grid's own measured height — the same figure the grid subtracts this
// panel from, so the two always add up to the area they share.
export function TotalsPanelOverlay({
  hasRows,
  availableHeight,
  children,
}: {
  hasRows: boolean
  availableHeight: number
  children: ReactNode
}) {
  const [open, setOpen] = useTotalsPanelOpen(hasRows)
  const [fraction, setFraction] = useTotalsPanelHeight()
  // Only the panel follows the pointer; the grid resizes once, on release — a live grid height would
  // re-virtualize up to 1000 rows per pointermove.
  const [dragFraction, setDragFraction] = useState<number | null>(null)
  const drag = useRef<{ y: number; fraction: number } | null>(null)
  // `top` animates only while folding or unfolding: a stored split arriving after hydration, or the
  // grid's measured height replacing its fallback, would otherwise slide the panel on every load.
  const [settledOpen, setSettledOpen] = useState(open)
  const isToggling = open !== settledOpen

  const shownFraction = dragFraction ?? (open ? fraction : 0)
  const isFull = shownFraction >= FULL_PANEL_FRACTION

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (event.button !== 0 || drag.current) return
    event.preventDefault()
    drag.current = { y: event.clientY, fraction: shownFraction }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragFraction(shownFraction)
  }

  function fractionAt(start: { y: number; fraction: number }, clientY: number) {
    return clampFraction(start.fraction + (start.y - clientY) / availableHeight)
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (!drag.current) return
    setDragFraction(fractionAt(drag.current, event.clientY))
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    const start = drag.current
    if (!start) return
    endDrag()
    if (Math.abs(start.y - event.clientY) < CLICK_SLOP_PX) return setOpen(false)
    const snap = snapPanelFraction(fractionAt(start, event.clientY))
    if (snap.open) setFraction(snap.fraction)
    setOpen(snap.open)
  }

  function endDrag() {
    if (!drag.current) return
    drag.current = null
    setDragFraction(null)
  }

  function onTransitionEnd(event: TransitionEvent<HTMLElement>) {
    if (event.target === event.currentTarget && event.propertyName === 'top') setSettledOpen(open)
  }

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      onTransitionEnd={onTransitionEnd}
      // Anchored by its top edge at the grid's bottom: the measured grid height stops a gap short of
      // the window, and the panel fills that gap down to `bottom-0`.
      style={{ top: panelTop(shownFraction, availableHeight) }}
      className={cn(
        'border-border bg-background text-foreground shadow-panel absolute inset-x-0 bottom-0 z-20 flex flex-col border-t data-[state=closed]:border-transparent data-[state=closed]:shadow-none',
        isToggling && dragFraction === null && 'transition-[top] duration-200 ease-out',
      )}
    >
      {open && (
        // Only the pill's own width overhangs the grid — a full-width strip would steal clicks from
        // its last row and its horizontal scrollbar. At full height there is no grid to overhang,
        // and the container's `overflow-hidden` would clip the pill, so it drops inside the panel.
        <span
          role="separator"
          aria-orientation="horizontal"
          title="Przeciągnij, aby zmienić wysokość — kliknij, aby zwinąć"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
          className={cn(
            'group absolute left-1/2 z-10 flex h-6 w-28 -translate-x-1/2 cursor-row-resize touch-none items-center justify-center',
            isFull ? 'top-0' : '-top-3',
          )}
        >
          <EdgeHandlePill orientation="horizontal">
            <ChevronDown className="size-3" />
          </EdgeHandlePill>
        </span>
      )}
      <Collapsible.Content
        forceMount
        className="flex min-h-0 flex-1 flex-col overflow-hidden transition-[visibility] duration-200 data-[state=closed]:invisible"
      >
        {children}
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
