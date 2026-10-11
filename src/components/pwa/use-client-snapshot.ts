import { useSyncExternalStore } from 'react'

const subscribeNever = () => () => {}

/** A browser-only value read once after hydration; the server render and the first pass see `undefined`. */
export const useClientSnapshot = <T>(read: () => T): T | undefined =>
  useSyncExternalStore(subscribeNever, read, () => undefined)
