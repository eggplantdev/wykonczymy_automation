import { describe, expect, it, vi } from 'vitest'
import { createSaveLanes } from '@/lib/kosztorys/save-lanes'
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

  // A rejection is a request that never completed — the browser's own text („Failed to fetch") is
  // not a message for the user, and the code keeps it apart from a refusal the caller must reseed on.
  it('routes a rejected action to onError as a coded Polish failure and never rejects the lane (EX-940)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const lanes = createSaveLanes()
    const onError = vi.fn()
    await expect(
      lanes.enqueue('item:1:name', () => Promise.reject(new TypeError('Failed to fetch')), onError),
    ).resolves.toBeUndefined()
    expect(onError).toHaveBeenCalledWith(expect.stringMatching(/Brak połączenia/), 'REQUEST_FAILED')
    expect(onError).not.toHaveBeenCalledWith(expect.stringMatching(/Failed to fetch/), expect.anything())
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
