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

  // Settles once every listed lane's current tail has — whatever was enqueued on them before the call.
  async function drain(keys: Iterable<string>): Promise<void> {
    await Promise.all([...new Set(keys)].map((key) => tails.get(key) ?? Promise.resolve()))
  }

  function drainAll(): Promise<void> {
    return drain(tails.keys())
  }

  return { enqueue, drain, drainAll }
}

type DispatchT = (key: string, run: LaneRunT, onError?: () => void) => Promise<void>

/**
 * The debounce in front of the lanes. `drain` FIRES a pending timer rather than cancelling it: a
 * caller about to write the same cells from the server (an accepted worker report adds to them) needs
 * the owner's just-typed figure stored first, or the server adds to the value before it and the
 * autosave then overwrites the sum.
 */
export function createDebouncedSaves(
  delay: number,
  dispatch: DispatchT,
  lanes: Pick<ReturnType<typeof createSaveLanes>, 'drain' | 'drainAll'>,
) {
  const pending = new Map<string, { timer: ReturnType<typeof setTimeout>; fire: () => void }>()

  function cancel(key: string) {
    const entry = pending.get(key)
    if (!entry) return
    clearTimeout(entry.timer)
    pending.delete(key)
  }

  function save(key: string, run: LaneRunT, onError?: () => void) {
    cancel(key)
    const fire = () => {
      pending.delete(key)
      void dispatch(key, run, onError)
    }
    pending.set(key, { timer: setTimeout(fire, delay), fire })
  }

  function runNow(key: string, run: LaneRunT, onError?: () => void) {
    cancel(key)
    return dispatch(key, run, onError)
  }

  async function drain(keys: Iterable<string>): Promise<void> {
    const unique = [...new Set(keys)]
    for (const key of unique) {
      const entry = pending.get(key)
      if (!entry) continue
      clearTimeout(entry.timer)
      entry.fire()
    }
    await lanes.drain(unique)
  }

  // For a write that replaces the whole tree under the grid: every typed cell must be stored first.
  async function drainAll(): Promise<void> {
    for (const entry of [...pending.values()]) {
      clearTimeout(entry.timer)
      entry.fire()
    }
    await lanes.drainAll()
  }

  function dispose() {
    for (const { timer } of pending.values()) clearTimeout(timer)
    pending.clear()
  }

  return { save, cancel, runNow, drain, drainAll, dispose }
}
