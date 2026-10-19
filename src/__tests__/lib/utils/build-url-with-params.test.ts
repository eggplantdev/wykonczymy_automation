import { describe, it, expect } from 'vitest'
import { buildUrlWithParams } from '@/lib/utils/build-url-with-params'

describe('buildUrlWithParams', () => {
  it('adds params to a clean URL', () => {
    const url = buildUrlWithParams('/items', '', { page: '2', limit: '50' })
    expect(url).toContain('/items?')
    expect(url).toContain('page=2')
    expect(url).toContain('limit=50')
  })

  it('overwrites existing params', () => {
    const url = buildUrlWithParams('/items', 'page=1&limit=20', { page: '3' })
    expect(url).toContain('page=3')
    expect(url).toContain('limit=20')
  })

  it('deletes params with empty string value', () => {
    const url = buildUrlWithParams('/items', 'page=1&filter=abc', { filter: '' })
    expect(url).not.toContain('filter')
    expect(url).toContain('page=1')
  })

  it('returns clean URL when all params are deleted', () => {
    const url = buildUrlWithParams('/items', 'page=1', { page: '' })
    expect(url).toBe('/items')
  })

  it('returns clean URL when no overrides given and no existing params', () => {
    const url = buildUrlWithParams('/items', '', {})
    expect(url).toBe('/items')
  })
})
