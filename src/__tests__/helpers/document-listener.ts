import { vi } from 'vitest'

// Filtered by key, because a chord like Shift+Enter also sends a bare Shift keydown.
export function withDocumentListener(type: string, key?: string) {
  const seen = vi.fn()
  const listener = (event: Event) => {
    if (!key || (event as KeyboardEvent).key === key) seen()
  }
  document.addEventListener(type, listener)
  return { seen, stop: () => document.removeEventListener(type, listener) }
}
