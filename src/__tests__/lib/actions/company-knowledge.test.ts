import { beforeEach, describe, expect, it, vi } from 'vitest'

// Asserted on what reached Payload and the DB, not on the returned message: a refusal is only real
// if nothing was written. The session is mocked rather than `requireAuth`, so the role gate under
// test is the real one.
vi.mock('server-only', () => ({}))
const { getCurrentUserJwt } = vi.hoisted(() => ({ getCurrentUserJwt: vi.fn() }))
vi.mock('@/lib/auth/get-current-user-jwt', () => ({ getCurrentUserJwt }))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const writes = vi.hoisted(() => ({
  create: vi.fn(async () => ({ id: 1 })),
  update: vi.fn(async () => ({})),
  delete: vi.fn(async () => ({})),
  execute: vi.fn(async () => ({ rows: [{ next: -1 }] })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('payload')>()),
  getPayload: vi.fn(async () => ({
    create: writes.create,
    update: writes.update,
    delete: writes.delete,
  })),
}))
vi.mock('@/lib/db/get-db', () => ({ getDb: vi.fn(async () => ({ execute: writes.execute })) }))

const {
  createCompanyKnowledgeAction,
  updateCompanyKnowledgeAction,
  deleteCompanyKnowledgeAction,
  reorderCompanyKnowledgeAction,
} = await import('@/lib/actions/company-knowledge')

const sessionAs = (role: string) =>
  getCurrentUserJwt.mockResolvedValue({ id: 1, email: 'u@t.com', name: 'Test', role })

const nothingWritten = () => {
  expect(writes.create).not.toHaveBeenCalled()
  expect(writes.update).not.toHaveBeenCalled()
  expect(writes.delete).not.toHaveBeenCalled()
  expect(writes.execute).not.toHaveBeenCalled()
}

describe('company knowledge actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionAs('MANAGER')
  })

  it('refuses every write from an EMPLOYEE session', async () => {
    sessionAs('EMPLOYEE')
    const results = [
      await createCompanyKnowledgeAction({ topic: 'Temat', content: 'Treść' }),
      await updateCompanyKnowledgeAction(1, { topic: 'Temat', content: 'Treść' }),
      await deleteCompanyKnowledgeAction(1),
      await reorderCompanyKnowledgeAction([1, 2]),
    ]
    expect(results.every((result) => !result.success)).toBe(true)
    nothingWritten()
  })

  it.each([
    { topic: '   ', content: 'Treść' },
    { topic: 'Temat', content: '\n  ' },
  ])('refuses an entry blank after trimming: %o', async (data) => {
    expect((await createCompanyKnowledgeAction(data)).success).toBe(false)
    expect((await updateCompanyKnowledgeAction(1, data)).success).toBe(false)
    nothingWritten()
  })

  it.each([[[]], [[1, 2, 1]], [[0, 1]]])('refuses the order %j', async (ids) => {
    expect((await reorderCompanyKnowledgeAction(ids)).success).toBe(false)
    nothingWritten()
  })

  it('creates a trimmed entry above the current top', async () => {
    const result = await createCompanyKnowledgeAction({ topic: ' Temat ', content: ' Treść ' })
    expect(result.success).toBe(true)
    expect(writes.create).toHaveBeenCalledWith({
      collection: 'company-knowledge',
      data: { topic: 'Temat', content: 'Treść', displayOrder: -1 },
    })
  })
})
