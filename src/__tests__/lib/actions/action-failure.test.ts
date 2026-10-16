import { describe, expect, it } from 'vitest'
import { NotFound } from 'payload'
import { toActionFailure } from '@/lib/actions/action-failure'
import { uk } from '@/lib/i18n/dictionaries/uk'
import { failureMessage } from '@/lib/i18n/failure-message'

describe('toActionFailure', () => {
  it('tags a Payload NotFound so the caller can reseed instead of reverting one field', () => {
    const failure = toActionFailure(new NotFound())

    expect(failure.code).toBe('NOT_FOUND')
    expect(failure.error).not.toBe('Nie znaleziono')
  })

  // A Drizzle-wrapped Postgres failure's message is the whole statement plus its bind params.
  it('hides a failed query behind a generic message', () => {
    const driverError = Object.assign(
      new Error('insert or update violates foreign key constraint'),
      {
        severity: 'ERROR',
        code: '23503',
      },
    )
    const queryError = Object.assign(
      new Error('Failed query: INSERT INTO kosztorys_snapshots (taken_by) VALUES ($1)\nparams: 7'),
      { query: 'INSERT INTO kosztorys_snapshots (taken_by) VALUES ($1)', params: [7] },
      { cause: driverError },
    )

    expect(toActionFailure(queryError).error).not.toMatch(/Failed query|INSERT|foreign key/)
    expect(toActionFailure(driverError).error).not.toMatch(/foreign key/)
  })

  it('words a database failure in the worker’s language by its code, not its Polish sentence', () => {
    const failure = toActionFailure(Object.assign(new Error('boom'), { query: 'SELECT 1' }))

    expect(failure.code).toBe('DATABASE_ERROR')
    expect(failureMessage('uk', failure)).toBe(uk.common.databaseError)
  })

  it('leaves any other error untagged, with its own message', () => {
    const failure = toActionFailure(new Error('Kwota musi być dodatnia'))

    expect(failure.code).toBeUndefined()
    expect(failure.error).toBe('Kwota musi być dodatnia')
  })
})
