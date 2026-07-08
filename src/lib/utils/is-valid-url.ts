export default function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str)
    // http(s) require an authority. new URL() silently normalizes scheme-without-//
    // ('https:example.com' → 'https://example.com/'), which then breaks as a raw href,
    // so for these schemes require the literal '//'. Other schemes (data:, mailto:) don't.
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return str.toLowerCase().startsWith(`${url.protocol}//`)
    }
    return true
  } catch {
    return false
  }
}
