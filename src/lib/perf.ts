/** Lap timer — each call returns ms since the previous call (not since start). */
export function perfStart(): () => number {
  let prev = performance.now()
  return () => {
    const now = performance.now()
    const delta = Math.round(now - prev)
    prev = now
    return delta
  }
}
