'use client'

import { useRef, type KeyboardEvent, type SyntheticEvent } from 'react'
import { textColumn, type CellProps } from 'react-datasheet-grid'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { ReadOnlyLongText } from '@/components/ui/datasheet-grid/read-only-long-text'
import { Textarea } from '@/components/ui/textarea'
import type { StopEditingT } from '@/components/ui/datasheet-grid/types'

type PropsT = {
  value: string | null
  focus: boolean
  disabled?: boolean
  onCommit: (next: string | null) => void
  stopEditing: StopEditingT
}

// A grid cell for text too long for a 32px row: a truncated one-liner at rest, a textarea floating
// over the cell (and over the rows beneath it) while editing — the Sheets behaviour. Where editing
// is off the popover stands in for that overlay. Knows nothing about the domain: the caller supplies
// the commit path.
export function LongTextCell({ value, focus, disabled, onCommit, stopEditing }: PropsT) {
  // Disabled and merely-unfocused split here: an unfocused cell in an editable grid must keep its
  // click for starting the edit, so only the disabled one becomes a popover trigger.
  if (disabled) return <ReadOnlyLongText value={value} />
  if (!focus) return <ReadOnlyCellText>{value ?? ''}</ReadOnlyCellText>

  return <LongTextOverlay value={value} onCommit={onCommit} stopEditing={stopEditing} />
}

function LongTextColumnCell({
  rowData,
  setRowData,
  focus,
  disabled,
  stopEditing,
}: CellProps<string | null, unknown>) {
  return (
    <LongTextCell
      value={rowData}
      focus={focus}
      disabled={disabled}
      onCommit={setRowData}
      stopEditing={stopEditing}
    />
  )
}

// Free-text column whose value doesn't fit a 32px row. Spreads textColumn so
// copy/paste/delete/isCellEmpty are inherited unchanged; only the editor is swapped for the overlay.
// `disableKeys` is what hands Enter and the arrow keys to the textarea — the grid claims them
// otherwise.
export const longTextColumn = {
  ...textColumn,
  component: LongTextColumnCell,
  disableKeys: true,
}

// Next's App Router hydrates `document`, so React's delegated listeners and the grid's own document
// listeners hang off the SAME node — and stopPropagation never stops a co-located listener. Only
// stopImmediatePropagation does, and it only works because React's listener was registered at
// hydration, before the grid's effect added its own.
function swallow(event: SyntheticEvent) {
  event.stopPropagation()
  event.nativeEvent.stopImmediatePropagation()
}

// The same normalization the stock textColumn applies through `parseUserInput` — spreading it does
// NOT inherit that, since only the component it replaces ever called it. Without this an emptied
// cell persists '' where the column's own `deleteValue` and `isCellEmpty` still speak in `null`.
function normalize(raw: string): string | null {
  return raw.trim() || null
}

// Focus must happen synchronously in the keystroke that opened the cell (the grid doesn't prevent
// its default), and the value must be selected so that key replaces it rather than inserting at the
// caret. Module-level so the ref identity is stable: the cell re-renders per keystroke, and a fresh
// inline callback would be detached and re-attached — re-selecting the whole value every character.
function focusAndSelect(node: HTMLTextAreaElement | null) {
  node?.focus()
  node?.select()
}

// Mounts exactly when editing starts and unmounts when it ends, which is what makes the pre-edit
// value knowable (see the ref) and rules out committing on blur: the grid removes this node the
// moment it drops focus, and a removed node fires no blur in Chrome — there is no end-of-edit
// moment to write in. So it commits per keystroke, like the stock textColumn it replaces.
function LongTextOverlay({
  value,
  onCommit,
  stopEditing,
}: Pick<PropsT, 'value' | 'onCommit' | 'stopEditing'>) {
  const valueBeforeEdit = useRef(value)

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // The grid listens on `document`, so every key it also claims must be swallowed here — Escape
    // and Enter would otherwise drive selection underneath the cell, and Shift+Enter is its
    // insert-row shortcut rather than a newline.
    if (event.key === 'Escape') {
      event.preventDefault()
      swallow(event)
      // Only when something was actually typed: an Escape out of an untouched cell must not cost a
      // write, a revalidation and an undo entry.
      if (normalize(event.currentTarget.value) !== valueBeforeEdit.current)
        onCommit(valueBeforeEdit.current)
      // Explicit, because the grid's own default is `nextRow: true` — a cancelled edit must leave
      // the cursor where it was.
      stopEditing({ nextRow: false })
      return
    }
    // `disableKeys` makes the grid bail out of its Tab handling WITHOUT preventing the default, and
    // this textarea — unlike the stock cell's `tabIndex: -1` input — is natively tabbable, so an
    // unhandled Tab would move DOM focus out of the grid while it still believes it is editing.
    if (event.key === 'Tab') {
      event.preventDefault()
      swallow(event)
      stopEditing({ nextRow: false })
      return
    }
    if (event.key !== 'Enter') return
    swallow(event)
    if (event.shiftKey) return
    event.preventDefault()
    stopEditing({ nextRow: true })
  }

  return (
    <Textarea
      // Uncontrolled, so a keystroke can't be dropped by however the parent stores the row.
      defaultValue={value ?? ''}
      ref={focusAndSelect}
      // z-30 clears everything the grid paints over the rows — the active-cell frame and its drop
      // shadow (20), the selection markers (20), the expand-rows handle (25) — while staying under
      // the header (40). Padding matches the resting text's px-2 so the value doesn't shift
      // sideways when the overlay opens.
      className="absolute top-0 left-0 z-30 max-h-64 min-h-28 w-104 min-w-full resize-none overflow-auto px-2 py-1 shadow-md"
      // The grid resolves a click to a cell from its coordinates, so a click landing on the part of
      // the overlay that hangs over other rows would move the active cell and end the edit. It never
      // needs to see a click on the editor: the caret and drag-select are the browser's own default.
      onMouseDown={swallow}
      onChange={(event) => onCommit(normalize(event.target.value))}
      onKeyDown={onKeyDown}
    />
  )
}
