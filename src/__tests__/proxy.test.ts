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
  // A redirect here would also bounce the form's Server Action POST, so a send would silently fail.
  it('reaches the worker’s report link, and its send', () => {
    expect(redirectsToLogin('/z/Mieszkanie-Mokotow/Nikolajewicz/abc-DEF_123')).toBe(false)
    const send = proxy(
      new NextRequest('http://localhost:3000/z/Mieszkanie-Mokotow/Nikolajewicz/abc-DEF_123', {
        method: 'POST',
      }),
    )
    expect(send.headers.get('location')).toBeNull()
  })

  // The prefix went with the route (owner, 2026-10-05): a link handed out before the move is dead.
  it('is sent to log in for a report link from before the move to /z/', () => {
    expect(redirectsToLogin('/zgloszenie-prac/Nikolajewicz/abc-DEF_123')).toBe(true)
  })

  it('is sent to log in for the kierownik’s report queue', () => {
    expect(redirectsToLogin('/zgloszenia-prac')).toBe(true)
  })

  it('is sent to log in for the owner’s worker podgląd', () => {
    expect(redirectsToLogin('/podglad-pracownika/Nikolajewicz-59/124')).toBe(true)
  })
})
