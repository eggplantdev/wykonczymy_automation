import { create } from 'zustand'

type PendingStoreT = {
  pending: ReadonlyMap<string, string>
  start: (key: string, label: string) => void
  stop: (key: string) => void
}

export const usePendingStore = create<PendingStoreT>()((set) => ({
  pending: new Map(),

  // A new Map every time — Zustand compares by reference, so mutating in place would leave the
  // indicator unsubscribed from its own state.
  start: (key, label) => set((state) => ({ pending: new Map(state.pending).set(key, label) })),

  stop: (key) =>
    set((state) => {
      const next = new Map(state.pending)
      next.delete(key)
      return { pending: next }
    }),
}))

export function firstPendingLabel(pending: ReadonlyMap<string, string>) {
  return pending.values().next().value
}
