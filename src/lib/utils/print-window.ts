/**
 * Must be called synchronously from the click — an `await` first spends the user activation
 * `window.open` needs (Safari refuses outright, Chrome after a few seconds).
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

const LOGO_WAIT_MS = 4000

/**
 * a `document.write`-built page reports `complete` the moment it is closed, so printing on readyState
 * fires before the image is off the network and every page gets a blank box where the mark should be.
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
