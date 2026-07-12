// Collision-avoidance primitive shared by every uploaded-file namer: splice a short random id
// before the real extension so re-uploads of the same receipt and concurrent uploads never
// collide. Relying on Payload's auto-rename instead races under concurrency and throws
// ValidationError. One place owns the strategy so the id length / separator stay in lockstep.
export function splitExtension(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? { base: name.slice(0, dot), ext: name.slice(dot) } : { base: name, ext: '' }
}

export function appendShortId(base: string, ext: string): string {
  const shortId = crypto.randomUUID().slice(0, 6)
  return `${base}-${shortId}${ext}`
}
