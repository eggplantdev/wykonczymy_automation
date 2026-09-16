import { forwardRef, useLayoutEffect, useRef, type ComponentProps, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils/cn'
import { enterEscapeKeyDown } from '@/lib/utils/enter-escape-keydown'

// onKeyDown is omitted rather than forwarded: Enter/Escape MUST be swallowed here so the keypress
// can't also drive react-datasheet-grid's selection underneath the cell, and a raw handler would let
// a caller opt out of that.
type PropsT = Omit<ComponentProps<'input'>, 'onKeyDown'> & {
  onEnter?: (event: KeyboardEvent<HTMLInputElement>) => void
  onEscape?: (event: KeyboardEvent<HTMLInputElement>) => void
  // The grid's own editing flag for this cell. Passing it joins the cell to the grid's keyboard
  // model — Enter and typing open it, the value arrives selected so the first character replaces it,
  // and at rest the input is inert to the pointer so one click selects the cell like anywhere else.
  // Omitting it leaves the input permanently live, which is a cell reachable by mouse only.
  focus?: boolean
}

export const EditableCellInput = forwardRef<HTMLInputElement, PropsT>(function EditableCellInput(
  { className, onEnter, onEscape, focus, style, ...props },
  ref,
) {
  const input = useRef<HTMLInputElement | null>(null)

  // Layout, not passive: the grid does not preventDefault the keystroke that starts an edit, so the
  // caret has to arrive before the browser delivers that character — one paint later and the first
  // digit is typed into nothing. Same reason it blurs on the way out: without it the caret keeps
  // blinking in a cell the grid no longer considers active.
  useLayoutEffect(() => {
    const node = input.current
    if (focus === undefined || !node) return
    if (!focus) {
      node.blur()
      return
    }
    node.focus()
    node.select()
  }, [focus])

  return (
    <input
      ref={(node) => {
        input.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      }}
      className={cn(
        'typing-surface size-full bg-transparent px-2 text-left outline-none',
        focus === false && 'pointer-events-none',
        className,
      )}
      // Never a tab stop of its own: the grid moves between cells with Tab itself, and a natively
      // tabbable input would let focus wander out of the grid mid-edit.
      tabIndex={focus === undefined ? undefined : -1}
      style={style}
      onKeyDown={enterEscapeKeyDown({ onEnter, onEscape })}
      {...props}
    />
  )
})
