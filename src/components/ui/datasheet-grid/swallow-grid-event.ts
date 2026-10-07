import type { SyntheticEvent } from 'react'

// Next's App Router hydrates `document`, so React's delegated listeners and the grid's own document
// listeners hang off the SAME node — and stopPropagation never stops a co-located listener. Only
// stopImmediatePropagation does, and it only works because React's listener was registered at
// hydration, before the grid's effect added its own.
export function swallowGridEvent(event: SyntheticEvent) {
  event.stopPropagation()
  event.nativeEvent.stopImmediatePropagation()
}
