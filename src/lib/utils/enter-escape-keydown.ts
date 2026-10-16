import type { KeyboardEvent } from 'react'

// inside the grid the keypress would otherwise also drive react-datasheet-grid's selection
// underneath the cell
export function enterEscapeKeyDown<ElementT extends HTMLElement>(handlers: {
  onEnter?: (event: KeyboardEvent<ElementT>) => void
  onEscape?: (event: KeyboardEvent<ElementT>) => void
}) {
  return (event: KeyboardEvent<ElementT>) => {
    const handler =
      event.key === 'Enter'
        ? handlers.onEnter
        : event.key === 'Escape'
          ? handlers.onEscape
          : undefined
    if (!handler) return
    event.preventDefault()
    event.stopPropagation()
    handler(event)
  }
}
