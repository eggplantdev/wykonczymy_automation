// `crypto.randomUUID` is exposed only in a secure context, so it is undefined whenever the dev
// server is reached over a LAN IP (a phone hitting http://192.168.x.x) — localhost hides this.
// `getRandomValues` carries no such gate, so the fallback is still a real random v4.
export function randomId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()

  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
