import { vi } from 'vitest'

// The grid listens on `document`, so a spec proves an event was kept from it by listening there too.
// Filtered by key, because a chord like Shift+Enter also sends a bare Shift keydown — a key nothing
// has a reason to swallow.
export function withDocumentListener(type: string, key?: string) {
  const seen = vi.fn()
  const listener = (event: Event) => {
    if (!key || (event as KeyboardEvent).key === key) seen()
  }
  document.addEventListener(type, listener)
  return { seen, stop: () => document.removeEventListener(type, listener) }
}
