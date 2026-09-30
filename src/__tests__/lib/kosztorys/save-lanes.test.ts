import { describe, expect, it, vi } from 'vitest'
import { createDebouncedSaves, createSaveLanes } from '@/lib/kosztorys/save-lanes'
import type { ActionResultT } from '@/types/action'

const ok = (): ActionResultT => ({ success: true })
const fail = (error: string): ActionResultT => ({ success: false, error })
const failNotFound = (): ActionResultT => ({
  success: false,
  error: 'Ten rekord już nie istnieje — dane zmieniły się w innym miejscu.',
  code: 'NOT_FOUND',
})

// A deferred whose resolution the test controls, to force a slow forward save that finishes AFTER a
// later-enqueued inverse would have, absent serialization.
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('createSaveLanes', () => {
  it('serializes same-key writes: an inverse enqueued during an in-flight forward runs after it (EX-526 #1)', async () => {
    const lanes = createSaveLanes()
    const order: string[] = []
    const forwardGate = deferred<void>()

    // Forward save is slow — it won't settle until the test opens the gate.
    const forward = lanes.enqueue('item:1:name', async () => {
      await forwardGate.promise
      order.push('forward')
      return ok()
    })
    // Inverse enqueued while the forward is still in flight.
    const inverse = lanes.enqueue('item:1:name', async () => {
      order.push('inverse')
      return ok()
    })

    forwardGate.resolve()
    await Promise.all([forward, inverse])

    expect(order).toEqual(['forward', 'inverse'])
  })

  it('does not serialize across different keys: a fast write on key B need not wait for a slow one on key A', async () => {
    const lanes = createSaveLanes()
    const order: string[] = []
    const gateA = deferred<void>()

    const slowA = lanes.enqueue('item:1:name', async () => {
      await gateA.promise
      order.push('A')
      return ok()
    })
    const fastB = lanes.enqueue('item:2:name', async () => {
      order.push('B')
      return ok()
    })

    await fastB // B settles without A's gate opening → lanes are independent
    expect(order).toEqual(['B'])

    gateA.resolve()
    await slowA
    expect(order).toEqual(['B', 'A'])
  })

  it('routes a logical failure (!success) to onError (EX-526 #3)', async () => {
    const lanes = createSaveLanes()
    const onError = vi.fn()
    await lanes.enqueue('item:1:name', async () => fail('rejected by server'), onError)
    expect(onError).toHaveBeenCalledWith('rejected by server', undefined)
  })

  it('routes a thrown/rejected action to onError and never rejects the lane (EX-526 #3)', async () => {
    const lanes = createSaveLanes()
    const onError = vi.fn()
    // enqueue must resolve (not reject) even though the action throws.
    await expect(
      lanes.enqueue(
        'item:1:name',
        async () => {
          throw new Error('network down')
        },
        onError,
      ),
    ).resolves.toBeUndefined()
    expect(onError).toHaveBeenCalledWith('network down')
  })

  // Without the code the caller can only match on the sentence, and „your row is gone" would keep
  // being handled as „your value was rejected" — a revert onto a tree that no longer exists.
  it('hands the failure code to onError so a stale-tree refusal is distinguishable', async () => {
    const lanes = createSaveLanes()
    const onError = vi.fn()
    await lanes.enqueue('item:1:plannedQty', async () => failNotFound(), onError)
    expect(onError).toHaveBeenCalledWith(expect.any(String), 'NOT_FOUND')
  })

  it('a failed write does not block the next write on the same key', async () => {
    const lanes = createSaveLanes()
    const ran: string[] = []
    await lanes.enqueue('item:1:name', async () => {
      ran.push('first')
      return fail('boom')
    })
    await lanes.enqueue('item:1:name', async () => {
      ran.push('second')
      return ok()
    })
    expect(ran).toEqual(['first', 'second'])
  })
})

describe('drain', () => {
  it('waits for an in-flight write on a listed lane', async () => {
    const lanes = createSaveLanes()
    const gate = deferred<void>()
    let isStored = false
    void lanes.enqueue('progress:1:2', async () => {
      await gate.promise
      isStored = true
      return ok()
    })

    let isDrained = false
    const drained = lanes.drain(['progress:1:2']).then(() => {
      isDrained = true
    })
    await Promise.resolve()
    expect(isDrained).toBe(false)

    gate.resolve()
    await drained
    expect(isStored).toBe(true)
  })

  it('fires a pending debounced save instead of dropping it, and waits for it', async () => {
    vi.useFakeTimers()
    try {
      const lanes = createSaveLanes()
      const stored: number[] = []
      const saves = createDebouncedSaves(500, (key, run) => lanes.enqueue(key, run), lanes)
      saves.save('progress:1:2', async () => {
        stored.push(7)
        return ok()
      })

      await saves.drain(['progress:1:2'])
      expect(stored).toEqual([7])

      // The timer it replaced must not fire a second write.
      await vi.advanceTimersByTimeAsync(1000)
      expect(stored).toEqual([7])
    } finally {
      vi.useRealTimers()
    }
  })

  it('leaves a pending save on an unlisted lane to its timer', async () => {
    vi.useFakeTimers()
    try {
      const lanes = createSaveLanes()
      const stored: string[] = []
      const saves = createDebouncedSaves(500, (key, run) => lanes.enqueue(key, run), lanes)
      saves.save('progress:9:2', async () => {
        stored.push('other')
        return ok()
      })

      await saves.drain(['progress:1:2'])
      expect(stored).toEqual([])
      await vi.advanceTimersByTimeAsync(500)
      expect(stored).toEqual(['other'])
    } finally {
      vi.useRealTimers()
    }
  })
})
