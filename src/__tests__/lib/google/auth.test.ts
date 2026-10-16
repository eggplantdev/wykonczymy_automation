import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  READER_CREDENTIAL,
  WRITER_CREDENTIAL,
  setGoogleCredentialEnv,
} from '@/__tests__/helpers/google-credentials'

beforeEach(() => {
  vi.resetModules()
  setGoogleCredentialEnv()
})

// Every „udostępnij jako Edytujący" surface renders what this returns, so handing back the Viewer
// address would have an owner grant Editor to the credential every laptop and every preview deploy carries.
describe('writeServiceAccountEmail', () => {
  it('names the Editor account, not the Viewer one the app reads with', async () => {
    const { writeServiceAccountEmail } = await import('@/lib/google/auth')
    const { serviceAccountEmail } = await import('@/lib/google/sheet-access')

    expect(writeServiceAccountEmail()).toBe(WRITER_CREDENTIAL.client_email)
    expect(writeServiceAccountEmail()).not.toBe(serviceAccountEmail())
    expect(serviceAccountEmail()).toBe(READER_CREDENTIAL.client_email)
  })

  it('still names an Editor address where the credential is absent — every environment but production', async () => {
    setGoogleCredentialEnv({ writer: false })
    const { writeServiceAccountEmail } = await import('@/lib/google/auth')

    const address = writeServiceAccountEmail()
    expect(address).toContain('kosztorys-sheets@')
    expect(address).not.toContain('reader')
  })
})

describe('hasWriteServiceAccountCredentials', () => {
  it('follows the credential, so one owner answers „can we write"', async () => {
    const { hasWriteServiceAccountCredentials } = await import('@/lib/google/auth')
    expect(hasWriteServiceAccountCredentials()).toBe(true)

    setGoogleCredentialEnv({ writer: false })
    expect(hasWriteServiceAccountCredentials()).toBe(false)
  })
})
