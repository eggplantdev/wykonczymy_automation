import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'

const visit = (path: string) => proxy(new NextRequest(`http://localhost:3000${path}`))
const redirectsToLogin = (path: string) =>
  visit(path).headers.get('location') === 'http://localhost:3000/zaloguj'

describe('proxy — a visitor without a session', () => {
  it('reaches the investor’s share link', () => {
    expect(redirectsToLogin('/k/abc')).toBe(false)
  })

  // The token is the worker's whole credential; he has no account to log in with.
  it('reaches the worker’s share link', () => {
    expect(redirectsToLogin('/p/Nikolajewicz/abc-DEF_123')).toBe(false)
  })

  it('is sent to log in for the owner’s worker podgląd', () => {
    expect(redirectsToLogin('/podglad-pracownika/Nikolajewicz-59/124')).toBe(true)
  })
})
