import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { redirect } from 'next/navigation'
import { settleAction, settled } from '@/lib/utils/settle-action'

describe('settleAction', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

  it('passes a resolved result through untouched', async () => {
    const result = { success: false as const, error: 'Nie znaleziono', code: 'NOT_FOUND' as const }
    expect(await settleAction(async () => result)).toBe(result)
  })

  it('turns a rejected request into a coded Polish failure', async () => {
    const res = await settleAction(() => Promise.reject(new TypeError('Failed to fetch')))

    expect(res).toMatchObject({ success: false, code: 'REQUEST_FAILED' })
    expect(res.success === false && res.error).toMatch(/Brak połączenia z serwerem/)
    expect(res.success === false && res.error).not.toMatch(/Failed to fetch/)
  })

  it('lets a redirect through, so a redirecting action still navigates', async () => {
    await expect(
      settleAction(async () => {
        redirect('/zaloguj')
      }),
    ).rejects.toMatchObject({ digest: expect.stringMatching(/^NEXT_REDIRECT/) })
  })
})

describe('settled', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

  it('forwards the arguments to the wrapped action', async () => {
    const action = vi.fn(async (id: number, name: string) => ({ success: true as const, id, name }))
    expect(await settled(action)(7, 'Etap')).toEqual({ success: true, id: 7, name: 'Etap' })
    expect(action).toHaveBeenCalledWith(7, 'Etap')
  })

  it('settles a rejection of the wrapped action', async () => {
    const action = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')))
    expect(await settled(action)()).toMatchObject({ success: false, code: 'REQUEST_FAILED' })
  })
})
