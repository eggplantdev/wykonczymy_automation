/**
 * Merges param overrides into existing search params and returns a full URL.
 * Empty-string values delete the key.
 */
export function buildUrlWithParams(
  baseUrl: string,
  currentParams: string,
  overrides: Record<string, string>,
): string {
  const params = new URLSearchParams(currentParams)

  for (const [key, value] of Object.entries(overrides)) {
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
  }

  const qs = params.toString()
  return `${baseUrl}${qs ? `?${qs}` : ''}`
}
