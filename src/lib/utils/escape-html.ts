/**
 * HTML-entity escape for interpolating untrusted text into generated HTML — email bodies and the
 * print documents.
 *
 * Quotes are escaped too, because the print builders interpolate into ATTRIBUTES (`<img src="…">`),
 * where `&<>` alone leaves the value free to close the attribute and open an `onerror=`. The print
 * popup is a same-origin `about:blank` fed by `document.write`, so that would run with the user's
 * session. In text position the quote entities render identically, so one function covers both.
 */
export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
