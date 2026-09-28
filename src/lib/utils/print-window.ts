/**
 * A print job spans a whole popup, so these are always used together: open the window on the click,
 * then hand it to `printThenClose` (or `writeAndPrint`, for a document built as an HTML string) once
 * its content is in place.
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

// A hung logo request fires neither `load` nor `error`, and the print dialog waits on one of them —
// so without a bound the popup sits there empty with nothing to tell the user. The document prints
// without its mark rather than not at all, which is the same call the `error` listener makes.
const LOGO_WAIT_MS = 4000

/**
 * Waits on the LOGO, not on the document: a `document.write`-built page reports `complete` the moment
 * it is closed, so printing on readyState fires before the image is off the network and every page
 * gets a blank box where the mark should be. `error` resolves too — a missing logo is not a reason to
 * withhold the document.
 */
export function writeAndPrint(target: Window, html: string) {
  target.document.write(html)
  target.document.close()
  const logo = target.document.querySelector('img')
  if (!logo || logo.complete) {
    printThenClose(target)
    return
  }
  let printed = false
  const print = () => {
    if (printed) return
    printed = true
    printThenClose(target)
  }
  logo.addEventListener('load', print, { once: true })
  logo.addEventListener('error', print, { once: true })
  setTimeout(print, LOGO_WAIT_MS)
}
