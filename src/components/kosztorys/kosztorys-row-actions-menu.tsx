'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

type PropsT = {
  x: number
  y: number
  // Insert + move have no meaning against a price-sorted view — disabled with a hint.
  sortActive: boolean
  // False on a section's last item (the "≥1 item per section" invariant) — delete disabled.
  canRemove: boolean
  onInsertAbove: () => void
  onInsertBelow: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  onClose: () => void
}

// Row actions menu, opened by the ⋯ button in the actions column (Wstaw powyżej/poniżej, Przesuń
// w górę/dół, Usuń). Portaled to body and positioned at {x,y} (the button's bottom-left): the app
// shell's <main> uses `transform-gpu`, which makes it the containing block for `position: fixed`,
// so a menu rendered in place would measure {x,y} from <main> (offset by the sidebar + scroll)
// instead of the viewport. body sits outside that transform. Closes on outside-click / Esc /
// scroll / resize so a stale menu never lingers over a scrolled grid.
export function KosztorysRowActionsMenu({
  x,
  y,
  sortActive,
  canRemove,
  onInsertAbove,
  onInsertBelow,
  onMoveUp,
  onMoveDown,
  onRemove,
  onClose,
}: PropsT) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    // `capture` so a scroll inside the grid's own scroll container (which doesn't bubble to window)
    // still closes the menu.
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  function run(action: () => void) {
    action()
    onClose()
  }

  const sortTitle = sortActive ? 'Najpierw zdejmij sortowanie kolumną' : undefined
  const item =
    'hover:bg-accent hover:text-accent-foreground block w-full px-3 py-1.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40'

  return createPortal(
    <div
      ref={ref}
      role="menu"
      className="border-border bg-popover text-popover-foreground fixed z-50 min-w-44 rounded-md border py-1 shadow-md"
      style={{ left: x, top: y }}
    >
      <button
        type="button"
        role="menuitem"
        disabled={sortActive}
        title={sortTitle}
        onClick={() => run(onInsertAbove)}
        className={item}
      >
        Wstaw pozycję powyżej
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={sortActive}
        title={sortTitle}
        onClick={() => run(onInsertBelow)}
        className={item}
      >
        Wstaw pozycję poniżej
      </button>
      <div className="bg-border my-1 h-px" role="separator" />
      <button
        type="button"
        role="menuitem"
        disabled={sortActive}
        title={sortTitle}
        onClick={() => run(onMoveUp)}
        className={item}
      >
        Przesuń w górę
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={sortActive}
        title={sortTitle}
        onClick={() => run(onMoveDown)}
        className={item}
      >
        Przesuń w dół
      </button>
      <div className="bg-border my-1 h-px" role="separator" />
      <button
        type="button"
        role="menuitem"
        disabled={!canRemove}
        title={canRemove ? undefined : 'Sekcja musi mieć co najmniej jedną pozycję'}
        onClick={() => run(onRemove)}
        className={`${item} text-destructive`}
      >
        Usuń pozycję
      </button>
    </div>,
    document.body,
  )
}
