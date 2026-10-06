'use client'

import * as Collapsible from '@radix-ui/react-collapsible'
import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { useTotalsPanelOpen } from '@/components/kosztorys/summary/hooks/use-totals-panel-open'
import { useTotalsPanelHeight } from '@/components/kosztorys/summary/hooks/use-totals-panel-height'
import { ChevronDown } from 'lucide-react'
import { EdgeHandlePill } from '@/components/ui/edge-handle-pill'
import {
  FULL_PANEL_FRACTION,
  clampFraction,
  panelTopPx,
  snapPanelFraction,
} from '@/lib/kosztorys/totals-panel-height'
import { cn } from '@/lib/utils/cn'

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

  const shownFraction = dragFraction ?? (open ? fraction : 0)

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (event.button !== 0 || drag.current) return
    event.preventDefault()
    drag.current = { y: event.clientY, fraction: shownFraction }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragFraction(shownFraction)
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (!drag.current) return
    const moved = (drag.current.y - event.clientY) / availableHeight
    setDragFraction(clampFraction(drag.current.fraction + moved))
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    if (!drag.current) return
    const released = clampFraction(
      drag.current.fraction + (drag.current.y - event.clientY) / availableHeight,
    )
    const moved = event.clientY !== drag.current.y
    drag.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
    setDragFraction(null)
    // A press that went nowhere is the sidebar pill's click: fold the panel away.
    if (!moved) return setOpen(false)
    const snap = snapPanelFraction(released)
    if (snap.open) setFraction(snap.fraction)
    setOpen(snap.open)
  }

  function abortDrag() {
    if (!drag.current) return
    drag.current = null
    setDragFraction(null)
  }

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      // Anchored by its top edge at the grid's bottom, not by a height: the measured grid height stops
      // a gap short of the window, and the panel fills that gap down to `bottom-0`.
      style={{
        top:
          shownFraction <= 0
            ? '100%'
            : shownFraction >= FULL_PANEL_FRACTION
              ? 0
              : panelTopPx(shownFraction, availableHeight),
      }}
      className={cn(
        // z-40, not z-20: the pill overhangs into the grid, whose frozen columns paint at z-30.
        'border-border bg-background text-foreground shadow-panel absolute inset-x-0 bottom-0 z-40 flex flex-col border-t data-[state=closed]:border-transparent data-[state=closed]:shadow-none',
        dragFraction === null && 'transition-[top] duration-200 ease-out',
      )}
    >
      {open && (
        // Astride the panel's top edge, like the sidebar's pill on its divider — hence `-top-3` and
        // the Root without `overflow-hidden`, which would clip the half that overhangs the grid.
        <span
          role="separator"
          aria-orientation="horizontal"
          title="Przeciągnij, aby zmienić wysokość — kliknij, aby zwinąć"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={abortDrag}
          onLostPointerCapture={abortDrag}
          className="group absolute inset-x-0 -top-3 z-10 flex h-6 cursor-row-resize touch-none items-center justify-center"
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
