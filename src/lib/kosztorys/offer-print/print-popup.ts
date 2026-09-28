import { printThenClose } from '@/lib/utils/print-window'
import { SECTION_COLORS } from '@/lib/kosztorys/section-colors'

/**
 * The palette lives in globals.css as `color-mix()` over the chart hues, and the print popup is a
 * document of its own with no stylesheet — so each section colour is resolved here, against the app's
 * own root, rather than duplicated as hex the two files could drift on.
 */
export function resolveSectionFills(): ReadonlyMap<string, string> {
  const probe = document.createElement('div')
  probe.style.display = 'none'
  document.body.append(probe)
  try {
    return new Map(
      SECTION_COLORS.map(({ key, fill }) => {
        probe.style.backgroundColor = fill
        return [key, getComputedStyle(probe).backgroundColor] as const
      }),
    )
  } finally {
    probe.remove()
  }
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
