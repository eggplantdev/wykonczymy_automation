import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import { verifySignature } from '@/lib/leads/verify-signature'

const secret = 'meta_app_secret_123'
const body = JSON.stringify({ object: 'page', entry: [{ id: '1', changes: [] }] })
const sign = (b: string, s: string) => 'sha256=' + createHmac('sha256', s).update(b).digest('hex')

describe('verifySignature', () => {
  it('accepts a signature computed with the right secret over the exact body', () => {
    expect(verifySignature(body, sign(body, secret), secret)).toBe(true)
  })

  it('rejects a tampered body', () => {
    const header = sign(body, secret)
    expect(verifySignature(body + ' ', header, secret)).toBe(false)
  })

  it('rejects a signature made with the wrong secret', () => {
    expect(verifySignature(body, sign(body, 'other_secret'), secret)).toBe(false)
  })

  it('rejects a missing header', () => {
    expect(verifySignature(body, null, secret)).toBe(false)
    expect(verifySignature(body, undefined, secret)).toBe(false)
  })

  it('rejects a header without the sha256= prefix', () => {
    const raw = createHmac('sha256', secret).update(body).digest('hex')
    expect(verifySignature(body, raw, secret)).toBe(false)
  })

  it('rejects a malformed / wrong-length digest', () => {
    expect(verifySignature(body, 'sha256=deadbeef', secret)).toBe(false)
  })
})
