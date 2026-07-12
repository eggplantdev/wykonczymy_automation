import { describe, it, expect } from 'vitest'
import { mapWithConcurrency } from '@/lib/utils/map-with-concurrency'

// A deferred promise so a test can control exactly when each item resolves.
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('mapWithConcurrency', () => {
  it('preserves input order in results regardless of completion order', async () => {
    const results = await mapWithConcurrency([10, 20, 30], 2, async (n) => n * 2)
    expect(results).toEqual([20, 40, 60])
  })

  it('never runs more than `limit` promises at once', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const items = [1, 2, 3, 4, 5, 6]

    await mapWithConcurrency(items, 2, async () => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((r) => setTimeout(r, 5))
      inFlight--
    })

    expect(maxInFlight).toBe(2)
  })

  it('passes the input index to fn', async () => {
    const results = await mapWithConcurrency(['a', 'b', 'c'], 3, async (item, i) => `${i}:${item}`)
    expect(results).toEqual(['0:a', '1:b', '2:c'])
  })

  it('propagates a rejection from fn', async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error('boom')
        return n
      }),
    ).rejects.toThrow('boom')
  })

  it('starts a queued item only after a slot frees (limit=1 serializes)', async () => {
    const order: number[] = []
    const gates = [deferred<void>(), deferred<void>()]

    const run = mapWithConcurrency([0, 1], 1, async (_item, i) => {
      order.push(i)
      await gates[i].promise
      return i
    })

    // limit=1: only item 0 has started; item 1 waits for the slot.
    await Promise.resolve()
    expect(order).toEqual([0])

    gates[0].resolve()
    gates[1].resolve()
    expect(await run).toEqual([0, 1])
    expect(order).toEqual([0, 1])
  })
})
