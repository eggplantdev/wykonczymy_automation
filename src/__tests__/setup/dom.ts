import '@testing-library/jest-dom/vitest'

// jsdom implements no layout engine, so these three report 0 / never fire and any component that
// measures itself renders as if it had no size. Radix and cmdk both gate on them, so without the
// stubs a popover mounts and then immediately hides — the failure reads as „option not found",
// which sends the reader after the selector instead of the environment.
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

// Radix Select drives its trigger through the Pointer Events capture API, which jsdom does not
// implement at all. Without these the first click on a select throws before the list ever opens.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
}
