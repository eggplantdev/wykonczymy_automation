import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

// Radix and cmdk gate on them — without the stubs a popover mounts and
// instantly hides
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

// jsdom's own `scrollTo` exists but logs „Not implemented” on every call.
window.scrollTo = () => {}

// Radix Select drives its trigger through the Pointer Events capture API, which jsdom does not
// implement at all. Without these the first click on a select throws before the list ever opens.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
}

// A spec asserting a toast imports `toastMessage` and reads it as the mock.
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

// The App Router hooks throw outside a mounted Next app.
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  ...(await import('@/__tests__/stubs/next-navigation')),
}))
