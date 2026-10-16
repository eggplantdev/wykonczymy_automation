import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  readOrder,
  readVisibility,
  writeOrder,
  writeVisibility,
} from '@/lib/table/column-prefs-storage'

function stubLocalStorage(initial: Record<string, string> = {}) {
  const backing = new Map(Object.entries(initial))
  const storage = {
    getItem: (key: string) => (backing.has(key) ? backing.get(key)! : null),
    setItem: (key: string, value: string) => void backing.set(key, value),
    removeItem: (key: string) => void backing.delete(key),
  }
  vi.stubGlobal('window', { localStorage: storage })
  vi.stubGlobal('localStorage', storage)
  return backing
}

let backing: Map<string, string>

beforeEach(() => {
  backing = stubLocalStorage()
})

afterEach(() => vi.unstubAllGlobals())

describe('readVisibility', () => {
  // The one stored value that white-screens the table rather than degrading: consumers index the
  // result (`columnVisibility[id] !== false`), and `null` parses without throwing.
  it('degrades a stored null to an empty map', () => {
    backing.set('table-columns:transfers', 'null')
    expect(readVisibility('transfers')).toEqual({})
  })

  it('drops non-boolean entries on read', () => {
    backing.set('table-columns:transfers', '{"amount":false,"date":"nope"}')
    expect(readVisibility('transfers')).toEqual({ amount: false })
  })
})

describe('readOrder / writeOrder', () => {
  it('round-trips a rank map', () => {
    writeOrder('transfers', { amount: 2, date: 0.5 })
    expect(readOrder('transfers')).toEqual({ amount: 2, date: 0.5 })
  })

  it('reads an absent key as an empty map', () => {
    expect(readOrder('never-written')).toEqual({})
  })

  it('degrades a corrupt value to an empty map', () => {
    backing.set('table-column-order:transfers', '{oops')
    expect(readOrder('transfers')).toEqual({})
  })

  // a NaN in the comparator would scramble the order with no error.
  it('drops non-finite ranks on read', () => {
    backing.set('table-column-order:transfers', '{"amount":2,"date":"x","type":null}')
    expect(readOrder('transfers')).toEqual({ amount: 2 })
  })

  it('keeps each table on its own key', () => {
    writeOrder('transfers', { amount: 2 })
    writeOrder('users', { role: 1 })
    expect(readOrder('transfers')).toEqual({ amount: 2 })
    expect(readOrder('users')).toEqual({ role: 1 })
  })
})

describe('order and visibility keys', () => {
  it('do not clobber each other under the same table key', () => {
    writeVisibility('transfers', { amount: false })
    writeOrder('transfers', { amount: 2 })
    expect(readVisibility('transfers')).toEqual({ amount: false })
    expect(readOrder('transfers')).toEqual({ amount: 2 })
  })
})
