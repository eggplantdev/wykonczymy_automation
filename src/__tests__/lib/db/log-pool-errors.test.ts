import { EventEmitter } from 'node:events'
import type { Payload } from 'payload'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { logIdlePoolErrors } from '@/lib/db/log-pool-errors'

describe('logIdlePoolErrors', () => {
  afterEach(() => vi.restoreAllMocks())

  it('logs an idle client error the pool re-emits instead of throwing it', () => {
    const pool = new EventEmitter()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    logIdlePoolErrors({ db: { pool } } as unknown as Payload)

    expect(() => pool.emit('error', new Error('Connection terminated unexpectedly'))).not.toThrow()
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('pool'),
      'Connection terminated unexpectedly',
    )
  })
})
