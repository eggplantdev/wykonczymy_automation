import { useState } from 'react'
import { SimpleTooltip } from '@/components/ui/tooltip'
import type { ReactNode } from 'react'

// `kosztorys-cell-input-body` (globals.css) keeps this wrapper geometrically invisible: the grid
// shapes a cell's direct span into the wrapping, clipping, margined box that read-only TEXT needs,
// and an input pushed through that box sits a few pixels off the same figure in the cell next door.
//
// Neutralising it costs the read-only branch its vertical box, though — that rule reaches a cell's
// DIRECT span only, and here the direct span is this wrapper. So the centring is done here instead,
// where it serves both branches: the input fills the wrapper via `size-full` and centres itself, a
// `—` or a derived figure is centred by the flex box rather than hanging at the top of the row.
const CELL_WRAPPER = 'kosztorys-cell-input-body flex size-full flex-col justify-center'

// The verdict explains itself where the user is typing rather than in a corner toast, mirroring the
// blocked-action tooltip in kosztorys-row-actions-menu.tsx. `forceOpen` exists because nobody hovers
// a cell they are typing into.
//
// The tree shape NEVER varies with `message`: returning bare children when there is nothing to say
// would change the element type at this position the moment a verdict appears, and React answers a
// changed type by unmounting the subtree — which destroys the input the user is typing into, one
// keystroke after they cross the threshold. Same reason `open` is driven by our own hover state
// rather than left uncontrolled some of the time: Radix would be switching controlled modes.
export function CellTooltip({
  message,
  forceOpen,
  children,
}: {
  message: string | null
  forceOpen: boolean
  children: ReactNode
}) {
  const [reveal, setReveal] = useState(false)
  return (
    <SimpleTooltip content={message ?? ''} open={message != null && (forceOpen || reveal)}>
      <span
        className={CELL_WRAPPER}
        onPointerEnter={() => setReveal(true)}
        onPointerLeave={() => setReveal(false)}
        // Taking `open` over from Radix took its focus handling with it, and a keyboard user tabbing
        // into a refused cell was left with a red number and no sentence.
        onFocusCapture={() => setReveal(true)}
        onBlurCapture={() => setReveal(false)}
      >
        {children}
      </span>
    </SimpleTooltip>
  )
}
