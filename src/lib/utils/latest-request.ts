export type LatestRequestT = {
  start: () => () => boolean
  disown: () => void
}

export function createLatestRequest(): LatestRequestT {
  let latest = 0

  return {
    start() {
      const id = ++latest
      return () => latest === id
    },
    disown() {
      latest += 1
    },
  }
}
