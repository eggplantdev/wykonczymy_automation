export default function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str)
    // new URL() silently normalizes scheme-without-// ('https:example.com' → 'https://example.com/'),
    // which then breaks as a raw href, so for these schemes require the literal '//'.
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return str.toLowerCase().startsWith(`${url.protocol}//`)
    }
    return true
  } catch {
    return false
  }
}
