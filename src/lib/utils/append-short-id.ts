import { randomId } from '@/lib/utils/random-id'

// Collision-avoidance primitive shared by every uploaded-file namer: splice a short random id
// before the real extension so re-uploads of the same receipt and concurrent uploads never
// collide. Relying on Payload's auto-rename instead races under concurrency and throws
// ValidationError. One place owns the strategy so the id length / separator stay in lockstep.
export function splitExtension(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? { base: name.slice(0, dot), ext: name.slice(dot) } : { base: name, ext: '' }
}

export function appendShortId(base: string, ext: string): string {
  // Through `randomId`, not `crypto.randomUUID` directly: every caller is server-side today, but
  // that is not written down anywhere, and the first client one would hit the non-secure-context
  // gap `random-id.ts` exists to close — on a phone reaching the dev server over a LAN IP.
  const shortId = randomId().slice(0, 6)
  return `${base}-${shortId}${ext}`
}
