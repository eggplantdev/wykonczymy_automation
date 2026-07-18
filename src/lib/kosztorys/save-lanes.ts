import type { ActionResultT } from '@/types/action'

// A per-key serialized write lane. Every write for a given key (item field, item×stage) chains behind
// the previous one, so a forward autosave and an undo's inverse write to the same cell can never race:
// the inverse is enqueued *after* the in-flight forward and observes its result, instead of both hitting
// the row with no ordering. Pure + React-free so the ordering contract is unit-testable without a DOM.
//
// EX-526 (S-07 undo hardening): the 700ms coalesce window is longer than the 500ms save debounce, so by
// the time an undo command exists its forward save has already dispatched. Cancelling a *timer* can't
// stop an in-flight action — serialization can.
export type LaneRunT = () => Promise<ActionResultT>

export function createSaveLanes() {
  // A settled tail is dropped from this map so it can't grow unbounded across a session.
  const tails = new Map<string, Promise<void>>()

  // Chain `run` behind the key's current tail. Failures (logical `!success` or a thrown/rejected
  // action) route to `onError` and are swallowed so the lane never rejects and the next write still
  // runs. Returns the promise for *this* write settling.
  function enqueue(key: string, run: LaneRunT, onError?: (message: string) => void): Promise<void> {
    const prev = tails.get(key) ?? Promise.resolve()
    const next = prev.then(async () => {
      try {
        const res = await run()
        if (!res.success) onError?.(res.error)
      } catch (error) {
        onError?.(error instanceof Error ? error.message : 'Błąd zapisu')
      }
    })
    tails.set(key, next)
    void next.then(() => {
      if (tails.get(key) === next) tails.delete(key)
    })
    return next
  }

  return { enqueue }
}
