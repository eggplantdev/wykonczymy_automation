import { describe, expect, it } from 'vitest'
import { workerSchema } from '@/components/forms/worker-form/worker-schema'

const worker = (language: unknown) => ({
  name: 'Jan Kowalski',
  email: '',
  role: 'EMPLOYEE',
  active: true,
  language,
})

describe('workerSchema — the stored language', () => {
  it('stores Polish as no language', () => {
    expect(workerSchema.parse(worker('pl')).language).toBeNull()
    expect(workerSchema.parse(worker(null)).language).toBeNull()
  })

  it('stores a crew language as its code', () => {
    expect(workerSchema.parse(worker('uk')).language).toBe('uk')
    expect(workerSchema.parse(worker('ru')).language).toBe('ru')
  })

  it('refuses a language the app has no dictionary for', () => {
    expect(workerSchema.safeParse(worker('de')).success).toBe(false)
    expect(workerSchema.safeParse(worker('')).success).toBe(false)
  })
})
