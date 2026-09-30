import { settleAction } from '@/lib/utils/settle-action'
import type { ActionErrorCodeT, ActionResultT } from '@/types/action'

// A per-key serialized write lane. Every write for a given key (item field, item×stage) chains behind
// the previous one, so a forward autosave and an undo's inverse write to the same cell can never race:
// the inverse is enqueued *after* the in-flight forward and observes its result, instead of both hitting
// the row with no ordering. Pure + React-free so the ordering contract is unit-testable without a DOM.
//
// EX-526 (S-07 undo hardening): the 700ms coalesce window is longer than the 500ms save debounce, so by
// the time an undo command exists its forward save has already dispatched. Cancelling a *timer* can't
// stop an in-flight action — serialization can.
export type LaneRunT = () => Promise<ActionResultT>

// The lane key IS the ordering contract: a forward save and the undo that inverts it must land on the
// same string or they stop serializing — silently, with no type error and no failing test. So neither
// side spells the literal out; both ask here.
export function itemFieldLane(id: number, field: string | number | symbol): string {
  return `item:${id}:${String(field)}`
}

export function stageLane(id: number, stageId: number): string {
  return `progress:${id}:${stageId}`
}

export function createSaveLanes() {
  // A settled tail is dropped from this map so it can't grow unbounded across a session.
  const tails = new Map<string, Promise<void>>()

  // Chain `run` behind the key's current tail. Failures route to `onError` and are swallowed so the
  // lane never rejects and the next write still runs. The failure's `code` rides along: a write
  // refused because its row is GONE needs a different recovery from one refused on its value, and
  // the message alone can't be branched on. Returns the promise for *this* write settling.
  function enqueue(
    key: string,
    run: LaneRunT,
    onError?: (message: string, code?: ActionErrorCodeT) => void,
  ): Promise<void> {
    const prev = tails.get(key) ?? Promise.resolve()
    const next = prev.then(async () => {
      const res = await settleAction(run)
      if (!res.success) onError?.(res.error, res.code)
    })
    tails.set(key, next)
    void next.then(() => {
      if (tails.get(key) === next) tails.delete(key)
    })
    return next
  }

  return { enqueue }
}
