import { settleAction } from '@/lib/utils/settle-action'
import type { ActionErrorCodeT, ActionResultT } from '@/types/action'

// Every write for a given key (item field, item×stage) chains behind the previous one, so a forward
// autosave and an undo's inverse write to the same cell can never race.
export type LaneRunT = () => Promise<ActionResultT>

// A forward save and the undo that inverts it must land on the same string or they stop
// serializing — silently, with no type error and no failing test.
export function itemFieldLane(id: number, field: string | number | symbol): string {
  return `item:${id}:${String(field)}`
}

export function stageLane(id: number, stageId: number): string {
  return `progress:${id}:${stageId}`
}

export function createSaveLanes() {
  const tails = new Map<string, Promise<void>>()

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
 * `drain` FIRES a pending timer rather than cancelling it: a
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
