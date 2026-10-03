// A `router.refresh()` whose RSC fetch fails falls back to a hard navigation, which offline lands on
// the browser's own error page and takes the toast that explained the failure with it.
export function whenOnline(run: () => void) {
  if (navigator.onLine) return run()
  window.addEventListener('online', run, { once: true })
}
