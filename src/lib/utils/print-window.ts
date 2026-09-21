/**
 * A print job spans a whole popup, so the two halves below are always used together: open the
 * window on the click, then hand it to `printThenClose` once its content is in place.
 */

/**
 * Must be called synchronously from the click — an `await` first spends the user activation
 * `window.open` needs (Safari refuses outright, Chrome after a few seconds). Returns `null` when
 * the popup was blocked; the caller decides whether that deserves a toast.
 */
export function openPrintWindow(title: string): Window | null {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return null
  printWindow.document.title = title
  return printWindow
}

/**
 * Closes on `afterprint`, not right after `print()`: only Chrome blocks inside `print()`, so an
 * immediate `close()` would tear the window down mid-job in Safari and Firefox.
 */
export function printThenClose(printWindow: Window) {
  printWindow.addEventListener('afterprint', () => printWindow.close())
  printWindow.print()
}
