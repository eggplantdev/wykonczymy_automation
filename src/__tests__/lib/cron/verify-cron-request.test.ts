import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

import { isAuthorizedCronRequest } from '@/lib/cron/verify-cron-request'

describe('isAuthorizedCronRequest', () => {
  const previous = process.env.CRON_SECRET

  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret'
  })

  afterEach(() => {
    process.env.CRON_SECRET = previous
  })

  const request = (headers: Record<string, string> = {}) =>
    new NextRequest('http://localhost/api/cron/whatever', { headers })

  it('accepts the matching bearer token', () => {
    expect(isAuthorizedCronRequest(request({ authorization: 'Bearer test-secret' }))).toBe(true)
  })

  it('rejects a missing Authorization header', () => {
    expect(isAuthorizedCronRequest(request())).toBe(false)
  })

  it('rejects a wrong secret', () => {
    expect(isAuthorizedCronRequest(request({ authorization: 'Bearer wrong' }))).toBe(false)
  })

  it('rejects the bare secret without the Bearer scheme', () => {
    expect(isAuthorizedCronRequest(request({ authorization: 'test-secret' }))).toBe(false)
  })

  it('rejects everything when CRON_SECRET is unset', () => {
    delete process.env.CRON_SECRET
    expect(isAuthorizedCronRequest(request({ authorization: 'Bearer test-secret' }))).toBe(false)
    expect(isAuthorizedCronRequest(request({ authorization: 'Bearer ' }))).toBe(false)
  })
})
