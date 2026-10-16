import { useState } from 'react'

/**
 * A `useDraft(items.map(...))` gets a new array every render, resets on each one, and the form is
 * simply uneditable.
 */
export function useDraft<T>(source: T, isSame: (a: T, b: T) => boolean = Object.is) {
  // Both wrapped in a lambda: React reads a bare function argument as a lazy initializer / an
  // updater, so a function-typed `T` would be invoked and the draft would hold its return value.
  const [draft, setDraft] = useState(() => source)
  const [lastSource, setLastSource] = useState(() => source)

  if (!isSame(lastSource, source)) {
    setLastSource(() => source)
    setDraft(() => source)
  }

  return [draft, setDraft] as const
}
