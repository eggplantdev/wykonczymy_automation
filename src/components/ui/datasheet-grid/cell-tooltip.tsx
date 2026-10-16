import { useState } from 'react'
import { SimpleTooltip } from '@/components/ui/tooltip'
import type { ReactNode } from 'react'

const CELL_WRAPPER = 'kosztorys-cell-input-body flex size-full flex-col justify-center'

// The tree shape NEVER varies with `message`: returning bare children when there is nothing to say
// would change the element type at this position the moment a verdict appears, and React answers a
// changed type by unmounting the subtree — which destroys the input the user is typing into.
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
