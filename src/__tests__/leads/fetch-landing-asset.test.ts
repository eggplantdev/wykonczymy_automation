import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Payload } from 'payload'
import { LANDING_FIXTURE_HOST } from '@/__tests__/fixtures/landing-submission'

// This handler fetches a URL a stranger put in a JSON body. Everything below is about what it
// refuses to fetch, and about not trusting the server on the other end either.
process.env.LANDING_BLOB_HOST = LANDING_FIXTURE_HOST

import { fetchLandingAsset } from '@/lib/leads/fetch-landing-asset'
import { MAX_ASSET_BYTES } from '@/lib/leads/landing'

type CreateArgsT = { file?: { name: string; mimetype: string; size: number } }
const create = vi.fn(async (_args: CreateArgsT) => ({ id: 42 }))
const payload = { create } as unknown as Payload

const asset = (overrides: Partial<Parameters<typeof fetchLandingAsset>[1]> = {}) => ({
  url: `https://${LANDING_FIXTURE_HOST}/lazienka-a1b2c3.jpg`,
  filename: 'lazienka.jpg',
  contentType: 'image/jpeg',
  size: 1024,
  ...overrides,
})

/** A Response whose body streams `chunks` — the only way to exercise the byte counter. */
const streamed = (chunks: Uint8Array[], headers: Record<string, string>): Response =>
  ({
    ok: true,
    status: 200,
    headers: new Headers(headers),
    body: {
      getReader: () => {
        let index = 0
        return {
          read: async () =>
            index < chunks.length ? { done: false, value: chunks[index++] } : { done: true },
          cancel: async () => {},
        }
      },
    },
  }) as unknown as Response

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.unstubAllGlobals())

describe('fetchLandingAsset — what it refuses to fetch', () => {
  const fetchSpy = vi.fn()

  beforeEach(() => vi.stubGlobal('fetch', fetchSpy))

  it.each([
    ['a different host', 'https://evil.example.com/photo.jpg'],
    ['plain http', `http://${LANDING_FIXTURE_HOST}/photo.jpg`],
    ['a link-local address', 'http://169.254.169.254/latest/meta-data/'],
    // The two shapes a substring check lets through — the reason the guard compares hostnames.
    [
      'a host merely containing the allowlisted one',
      `https://${LANDING_FIXTURE_HOST}.evil.com/x.jpg`,
    ],
    [
      'the allowlisted host in a query string',
      `https://evil.example.com/?x=${LANDING_FIXTURE_HOST}`,
    ],
  ])('rejects %s without fetching', async (_label, url) => {
    await expect(fetchLandingAsset(payload, asset({ url }))).rejects.toThrow()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  // Not "does fetch follow redirects" — that a redirect is refused is the point: following one off
  // the allowlisted host is exactly the bypass the allowlist exists to stop.
  it('refuses to follow a redirect', async () => {
    await fetchLandingAsset(payload, asset()).catch(() => {})
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ redirect: 'error' })
  })

  it('rejects a declared size over the ceiling before fetching', async () => {
    await expect(fetchLandingAsset(payload, asset({ size: MAX_ASSET_BYTES + 1 }))).rejects.toThrow(
      /przekracza/,
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects a content type media would not store', async () => {
    await expect(
      fetchLandingAsset(payload, asset({ contentType: 'application/zip' })),
    ).rejects.toThrow(/typ pliku/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('fetchLandingAsset — what it refuses to store', () => {
  it('rejects an oversized content-length without reading the body', async () => {
    const getReader = vi.fn()
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-length': String(MAX_ASSET_BYTES + 1),
        'content-type': 'image/jpeg',
      }),
      body: { getReader },
    }))

    await expect(fetchLandingAsset(payload, asset())).rejects.toThrow(/przekracza/)
    expect(getReader).not.toHaveBeenCalled()
  })

  // The header is the sender's claim, not a fact — a hostile server understates it and streams on.
  it('catches a lying content-length mid-read', async () => {
    const chunk = new Uint8Array(1024 * 1024)
    vi.stubGlobal('fetch', async () =>
      streamed(
        Array.from({ length: 9 }, () => chunk),
        {
          'content-length': '1024',
          'content-type': 'image/jpeg',
        },
      ),
    )

    await expect(fetchLandingAsset(payload, asset())).rejects.toThrow(/przekracza/)
    expect(create).not.toHaveBeenCalled()
  })

  it('rejects a response whose content type contradicts the declared one', async () => {
    vi.stubGlobal('fetch', async () =>
      streamed([new Uint8Array(4)], { 'content-type': 'text/html; charset=utf-8' }),
    )

    await expect(fetchLandingAsset(payload, asset())).rejects.toThrow(/typ pliku/)
  })

  it('rejects a non-2xx response', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 404, headers: new Headers() }))

    await expect(fetchLandingAsset(payload, asset())).rejects.toThrow(/HTTP 404/)
  })

  it('stores an allowlisted file and returns its media id', async () => {
    vi.stubGlobal('fetch', async () =>
      streamed([new Uint8Array([1, 2, 3, 4])], { 'content-type': 'image/jpeg' }),
    )

    await expect(fetchLandingAsset(payload, asset())).resolves.toBe(42)

    const file = create.mock.calls[0][0].file!
    expect(file.mimetype).toBe('image/jpeg')
    expect(file.size).toBe(4)
    // The stored name carries a collision id, so two visitors' „IMG_1234.jpg" cannot overwrite.
    expect(file.name).not.toBe('lazienka.jpg')
    expect(file.name).toMatch(/^lazienka-.+\.jpg$/)
  })
})
