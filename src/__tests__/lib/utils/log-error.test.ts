import { describe, it, expect, vi, afterEach } from 'vitest'
import { logError } from '@/lib/utils/log-error'

describe('logError', () => {
  afterEach(() => vi.restoreAllMocks())

  it('logs the label and an Error message (not the raw Error)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logError('[label]', new Error('boom'))
    expect(spy).toHaveBeenCalledWith('[label]', 'boom')
  })

  it('logs a non-Error value as-is', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logError('[label]', 'plain string')
    expect(spy).toHaveBeenCalledWith('[label]', 'plain string')
  })

  it('unwraps a Payload ValidationError .data into pretty JSON as a trailing arg', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = Object.assign(new Error('Validation'), {
      data: { field: 'title', reason: 'required' },
    })
    logError('[label]', err)
    expect(spy).toHaveBeenCalledWith(
      '[label]',
      'Validation',
      JSON.stringify({ field: 'title', reason: 'required' }, null, 2),
    )
  })

  it('passes extra context args between the base message and the .data unwrap', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = Object.assign(new Error('boom'), { data: { k: 1 } })
    logError('[label]', err, 'row 3', 42)
    expect(spy).toHaveBeenCalledWith(
      '[label]',
      'boom',
      'row 3',
      42,
      JSON.stringify({ k: 1 }, null, 2),
    )
  })

  it('omits the .data arg entirely when absent', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logError('[label]', new Error('boom'), 'ctx')
    expect(spy).toHaveBeenCalledWith('[label]', 'boom', 'ctx')
  })

  it('logs the label alone for a message-only call (no err)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logError('[label] something happened')
    expect(spy).toHaveBeenCalledWith('[label] something happened')
  })
})
