'use client'

import type { PointerEvent, ReactNode } from 'react'
import { useRef } from 'react'

// Uchwyt do przeciągania prawej krawędzi nagłówka kolumny. datasheet-grid nie ma
// natywnego resize, a jego wewnętrzne memo nie przelicza szerokości bez remountu —
// dlatego NIE zmieniamy szerokości na żywo. W trakcie dragu pokazujemy tylko pionową
// prowadnicę (onGuide = współrzędna X kursora), a faktyczną szerokość commitujemy na puść
// (onCommit), co remountuje siatkę z nową szerokością. Startową szerokość mierzymy z DOM
// komórki nagłówka (closest('.dsg-cell-header')) — działa też dla kolumn jeszcze nieprzypiętych.

type PropsT = {
  colId: string
  minWidth: number
  onGuide: (x: number | null) => void // X kursora dla prowadnicy (null = koniec dragu)
  onCommit: (id: string, width: number) => void // na puść → persist + remount
  children: ReactNode
}

export function ResizableHeader({ colId, minWidth, onGuide, onCommit, children }: PropsT) {
  // startX = pozycja kursora w pointerdown; startW = zmierzona szerokość komórki.
  const drag = useRef<{ x: number; w: number } | null>(null)

  function widthAt(target: HTMLElement): number {
    const cell = target.closest('.dsg-cell-header')
    return cell?.getBoundingClientRect().width ?? minWidth
  }

  function onPointerDown(e: PointerEvent<HTMLElement>) {
    // Nie wywołuj sortu (SortHeader onClick) ani natywnej nawigacji komórki.
    e.preventDefault()
    e.stopPropagation()
    drag.current = { x: e.clientX, w: widthAt(e.currentTarget) }
    e.currentTarget.setPointerCapture(e.pointerId)
    onGuide(e.clientX)
  }

  function onPointerMove(e: PointerEvent<HTMLElement>) {
    if (!drag.current) return
    onGuide(e.clientX)
  }

  function onPointerUp(e: PointerEvent<HTMLElement>) {
    if (!drag.current) return
    const width = Math.max(minWidth, Math.round(drag.current.w + (e.clientX - drag.current.x)))
    drag.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
    onGuide(null)
    onCommit(colId, width)
  }

  // Wrapper celowo NIE jest position:relative — uchwyt (absolute) ma się kotwiczyć
  // do .dsg-cell-header (position:absolute biblioteki), nie do wrappera, żeby trafić
  // w PRAWDZIWĄ krawędź komórki, nie w koniec shrink-wrapowanej treści tytułu.
  return (
    <span className="flex h-full w-full items-center">
      {children}
      <span
        role="separator"
        aria-orientation="vertical"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={(e) => e.stopPropagation()}
        className="hover:bg-primary/40 absolute top-0 -right-1 z-10 h-full w-2 cursor-col-resize"
      />
    </span>
  )
}
