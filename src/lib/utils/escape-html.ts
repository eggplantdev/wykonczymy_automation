/**
 * Quotes are escaped too, because the print builders interpolate into ATTRIBUTES (`<img src="…">`),
 * where `&<>` alone leaves the value free to close the attribute and open an `onerror=`.
 */
export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
