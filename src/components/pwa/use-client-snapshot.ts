import { useSyncExternalStore } from 'react'

const subscribeNever = () => () => {}

export const useClientSnapshot = <T>(read: () => T): T | undefined =>
  useSyncExternalStore(subscribeNever, read, () => undefined)
