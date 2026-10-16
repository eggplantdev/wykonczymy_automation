import type { SyntheticEvent } from 'react'

// Next's App Router hydrates `document`, so React's delegated listeners and the grid's own document
// listeners hang off the SAME node — and stopPropagation never stops a co-located listener.
export function swallowGridEvent(event: SyntheticEvent) {
  event.stopPropagation()
  event.nativeEvent.stopImmediatePropagation()
}
