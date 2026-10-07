import { describe, it, expect } from 'vitest'
import { needsSessionRefresh } from '@/lib/auth/session-refresh'

const ISSUED_AT_SEC = 1_790_000_000
const DAY_MS = 24 * 60 * 60 * 1000
const issuedAtMs = ISSUED_AT_SEC * 1000

describe('needsSessionRefresh', () => {
  it('leaves a token younger than a day alone', () => {
    expect(needsSessionRefresh(ISSUED_AT_SEC, issuedAtMs + DAY_MS - 1000)).toBe(false)
  })

  it('slides a token older than a day', () => {
    expect(needsSessionRefresh(ISSUED_AT_SEC, issuedAtMs + DAY_MS + 1000)).toBe(true)
  })
})
