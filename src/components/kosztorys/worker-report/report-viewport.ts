import type { Viewport } from 'next'

// „Podsumowanie” is wider than a phone. Without a minimum scale the browser zooms out to fit it,
// which widens the layout viewport and drags the fixed mode switch across the sheet.
export const REPORT_VIEWPORT: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
}
