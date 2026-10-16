import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setGoogleCredentialEnv } from '@/__tests__/helpers/google-credentials'

const spreadsheetsGetMock = vi.fn()
const batchUpdateMock = vi.fn()

vi.mock('googleapis', () => ({
  google: {
    auth: {
      JWT: vi.fn().mockImplementation(function (this: object, opts: object) {
        Object.assign(this, opts)
        return this
      }),
    },
    sheets: vi.fn().mockReturnValue({
      spreadsheets: { get: spreadsheetsGetMock, batchUpdate: batchUpdateMock },
    }),
  },
}))

const SHEET = '152HYswm1ESgQxbk8rMt9JSeX1R-ppj49rbcZZtyCNBs'

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  setGoogleCredentialEnv()
  spreadsheetsGetMock.mockResolvedValue({ data: { properties: { title: 'Kowalski, Polna 3' } } })
  batchUpdateMock.mockResolvedValue({ data: {} })
})

describe('verifySheetAccess', () => {
  it('proves Editor rights with a no-op write where the Editor credential exists', async () => {
    const { verifySheetAccess } = await import('@/lib/google/sheet-access')

    await expect(verifySheetAccess(SHEET)).resolves.toEqual({ title: 'Kowalski, Polna 3' })
    expect(batchUpdateMock).toHaveBeenCalledTimes(1)
  })

  it('skips the probe without the Editor credential, and writes nothing at all', async () => {
    setGoogleCredentialEnv({ writer: false })
    const { verifySheetAccess } = await import('@/lib/google/sheet-access')

    await expect(verifySheetAccess(SHEET)).resolves.toEqual({ title: 'Kowalski, Polna 3' })
    expect(batchUpdateMock).not.toHaveBeenCalled()
  })

  it('reports no access when the sheet cannot even be read', async () => {
    spreadsheetsGetMock.mockRejectedValueOnce(Object.assign(new Error('forbidden'), { code: 403 }))
    const { verifySheetAccess } = await import('@/lib/google/sheet-access')

    await expect(verifySheetAccess(SHEET)).resolves.toBeNull()
    expect(batchUpdateMock).not.toHaveBeenCalled()
  })
})

describe('extractSheetId', () => {
  it('takes a pasted URL or a bare id, and refuses anything else', async () => {
    const { extractSheetId } = await import('@/lib/google/sheet-access')

    expect(extractSheetId(`https://docs.google.com/spreadsheets/d/${SHEET}/edit#gid=0`)).toBe(SHEET)
    expect(extractSheetId(`  ${SHEET}  `)).toBe(SHEET)
    expect(extractSheetId('https://example.com/nope')).toBeUndefined()
    expect(extractSheetId('')).toBeUndefined()
  })
})
