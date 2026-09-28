import { describe, it, expect, vi, beforeEach } from 'vitest'

// Podgląd and the PDF serve the same projection a worker link does, minus the token — so their ONLY
// gate is requireAuth. Asserted by effect: a rejected session never reaches the kosztorys at all.
vi.mock('server-only', () => ({}))

const authState = vi.hoisted(() => ({
  result: { success: true, user: { id: 1, email: 'o@t.com', name: 'Owner', role: 'OWNER' } } as
    | { success: true; user: { id: number; email: string; name: string; role: string } }
    | { success: false; error: string },
}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => authState.result),
}))

const buildKosztorysTree = vi.fn()
vi.mock('@/lib/queries/kosztorys', () => ({ buildKosztorysTree }))
vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({ findByID: vi.fn(), find: vi.fn(), findGlobal: vi.fn() })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

const { getWorkerKosztorysPreview } = await import('@/lib/queries/worker-kosztorys')
const { getWorkerKosztorysPrintData } =
  await import('@/lib/queries/worker-kosztorys-print-endpoint')

describe('worker kosztorys preview auth gate', () => {
  beforeEach(() => {
    buildKosztorysTree.mockReset()
  })

  it('rejects an unauthenticated read without touching the kosztorys', async () => {
    authState.result = { success: false, error: 'Brak autoryzacji' }

    await expect(getWorkerKosztorysPreview(42, 7)).rejects.toThrow('Brak autoryzacji')
    expect(buildKosztorysTree).not.toHaveBeenCalled()
  })

  it('rejects a role below MANAGEMENT_ROLES the same way — requireAuth owns the role check', async () => {
    authState.result = { success: false, error: 'Brak uprawnień' }

    await expect(getWorkerKosztorysPreview(42, 7)).rejects.toThrow('Brak uprawnień')
    expect(buildKosztorysTree).not.toHaveBeenCalled()
  })

  it('gates the PDF read behind the same check', async () => {
    authState.result = { success: false, error: 'Brak uprawnień' }

    await expect(getWorkerKosztorysPrintData(42, 7)).rejects.toThrow('Brak uprawnień')
    expect(buildKosztorysTree).not.toHaveBeenCalled()
  })
})
