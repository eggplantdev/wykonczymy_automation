import { randomId } from '@/lib/utils/random-id'

// Shared by every uploaded-file namer, so re-uploads of the same receipt and concurrent uploads never
// collide — Payload's auto-rename races under concurrency and throws ValidationError.
export function splitExtension(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? { base: name.slice(0, dot), ext: name.slice(dot) } : { base: name, ext: '' }
}

export function appendShortId(base: string, ext: string): string {
  // Through `randomId`, not `crypto.randomUUID`: nothing says the callers stay server-side, and the
  // first client one hits the non-secure-context gap `random-id.ts` exists to close.
  const shortId = randomId().slice(0, 6)
  return `${base}-${shortId}${ext}`
}
