import { afterAll, afterEach, vi, type Mock } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { navigationState } from '@/__tests__/stubs/next-navigation'
import { resetAuthState } from '@/__tests__/stubs/get-current-user-jwt'

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

// On `globalThis`: a module cached by an earlier `dom-shared` file keeps the toast it imported then.
vi.mock('@/lib/utils/toast', () => ({
  toastMessage: ((globalThis as { domToast?: Mock }).domToast ??= vi.fn()),
}))

// The App Router hooks throw outside a mounted Next app.
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  ...(await import('@/__tests__/stubs/next-navigation')),
}))

// `dom-shared` runs every file in one jsdom window; these run before the spec's own top-level setup.
Object.assign(navigationState, { pathname: '/', searchParams: new URLSearchParams() })
resetAuthState()
for (const action of (globalThis as { serverActionStubs?: Mock[] }).serverActionStubs ?? []) {
  action.mockReset()
}
window.history.replaceState(null, '', '/')
localStorage.clear()
sessionStorage.clear()

// Testing Library registers its auto-cleanup once per module instance — in `dom-shared` only for
// the first file.
afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

afterAll(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
