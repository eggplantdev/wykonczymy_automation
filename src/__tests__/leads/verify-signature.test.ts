import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import { verifySignature } from '@/lib/leads/verify-signature'

const secret = 'meta_app_secret_123'
const body = JSON.stringify({ object: 'page', entry: [{ id: '1', changes: [] }] })
const sign = (b: string, s: string) => 'sha256=' + createHmac('sha256', s).update(b).digest('hex')

describe('verifySignature — Meta scope (the raw app secret, which Meta owns)', () => {
  it('accepts a signature computed with the right secret over the exact body', () => {
    expect(verifySignature(body, sign(body, secret), secret, 'meta')).toBe(true)
  })

  it('rejects a tampered body', () => {
    const header = sign(body, secret)
    expect(verifySignature(body + ' ', header, secret, 'meta')).toBe(false)
  })

  it('rejects a signature made with the wrong secret', () => {
    expect(verifySignature(body, sign(body, 'other_secret'), secret, 'meta')).toBe(false)
  })

  it('rejects a missing header', () => {
    expect(verifySignature(body, null, secret, 'meta')).toBe(false)
    expect(verifySignature(body, undefined, secret, 'meta')).toBe(false)
  })

  it('rejects a header without the sha256= prefix', () => {
    const raw = createHmac('sha256', secret).update(body).digest('hex')
    expect(verifySignature(body, raw, secret, 'meta')).toBe(false)
  })

  it('rejects a malformed / wrong-length digest', () => {
    expect(verifySignature(body, 'sha256=deadbeef', secret, 'meta')).toBe(false)
  })
})

// The hole this closes: a cleanup body IS a `submissionId`, and so is part of every submission
// envelope — so under one undifferentiated key a signed submission doubled as a valid „delete this
// submission's files" instruction for anyone holding a copy of it. The oracle here derives the key
// the same way the implementation does; what it proves is that the two scopes disagree.
describe('verifySignature — scope separation', () => {
  const shared = 'shared-landing-secret'
  const payload = JSON.stringify({ submissionId: '9f2c1b64-7d3a-4e58-9a10-6c5b2e8f4d71' })
  const scoped = (scope: string) =>
    'sha256=' +
    createHmac('sha256', createHmac('sha256', shared).update(scope, 'utf8').digest())
      .update(payload, 'utf8')
      .digest('hex')

  it('refuses a submission signature presented as a cleanup instruction', () => {
    const header = scoped('landing-submission')
    expect(verifySignature(payload, header, shared, 'landing-submission')).toBe(true)
    expect(verifySignature(payload, header, shared, 'landing-cleanup')).toBe(false)
  })

  it('refuses a cleanup signature presented as a submission', () => {
    const header = scoped('landing-cleanup')
    expect(verifySignature(payload, header, shared, 'landing-cleanup')).toBe(true)
    expect(verifySignature(payload, header, shared, 'landing-submission')).toBe(false)
  })

  // Meta's scheme signs with the bare secret, so it must stay OUTSIDE the derivation — otherwise
  // every Facebook lead starts failing its signature check.
  it('leaves the Meta scope on the undivided secret', () => {
    const bare = 'sha256=' + createHmac('sha256', shared).update(payload, 'utf8').digest('hex')
    expect(verifySignature(payload, bare, shared, 'meta')).toBe(true)
    expect(verifySignature(payload, bare, shared, 'landing-submission')).toBe(false)
  })
})
