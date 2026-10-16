import { afterEach, describe, expect, it, vi } from 'vitest'
import { createJsonMapStore, parseJsonMap } from '@/hooks/create-json-map-store'

function stubLocalStorage(initial: Record<string, string> = {}) {
  const backing = new Map(Object.entries(initial))
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => (backing.has(key) ? backing.get(key)! : null),
      setItem: (key: string, value: string) => void backing.set(key, value),
      removeItem: (key: string) => void backing.delete(key),
    },
  })
  return backing
}

afterEach(() => vi.unstubAllGlobals())

// an unguarded JSON.parse white-screens the grid on a corrupt value — or on the
// literal "null", which parses fine and then makes map[id] throw.
describe('parseJsonMap', () => {
  it('parses a plain object map', () => {
    expect(parseJsonMap<number>('{"a":1,"b":2}')).toEqual({ a: 1, b: 2 })
  })

  it('degrades the literal "null" to an empty map', () => {
    expect(parseJsonMap('null')).toEqual({})
  })

  it('degrades a corrupt value to an empty map', () => {
    expect(parseJsonMap('{oops')).toEqual({})
  })

  it('rejects a JSON array (not a usable map)', () => {
    expect(parseJsonMap('[1,2,3]')).toEqual({})
  })
})

describe('createJsonMapStore.update', () => {
  it('re-reads before each write, so two writes in one tick both persist', () => {
    const backing = stubLocalStorage()
    const store = createJsonMapStore<number>('k')
    store.update((prev) => ({ ...prev, a: 1 }))
    store.update((prev) => ({ ...prev, b: 2 }))
    expect(JSON.parse(backing.get('k')!)).toEqual({ a: 1, b: 2 })
  })

  it('builds the write on the persisted value, not a snapshot captured earlier', () => {
    const backing = stubLocalStorage({ k: '{"w":10}' })
    const store = createJsonMapStore<number>('k')
    backing.set('k', '{"w":10,"x":99}')
    store.update((prev) => {
      const next = { ...prev }
      delete next.w
      return next
    })
    expect(JSON.parse(backing.get('k')!)).toEqual({ x: 99 })
  })

  it('skips persist + notify when the updater returns its input unchanged', () => {
    const backing = stubLocalStorage({ k: '{"a":1}' })
    const store = createJsonMapStore<number>('k')
    let notified = 0
    store.subscribe(() => {
      notified += 1
    })
    store.update((prev) => prev)
    expect(notified).toBe(0)
    expect(backing.get('k')).toBe('{"a":1}')
  })
})
