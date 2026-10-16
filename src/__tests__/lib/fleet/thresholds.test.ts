import { describe, it, expect } from 'vitest'
import { OVERDUE, classifyDeadline, isMoreUrgent } from '@/lib/fleet/thresholds'

const TODAY = '2026-08-18'

describe('classifyDeadline', () => {
  it('has no bucket without a due date', () => {
    expect(classifyDeadline(null, TODAY)).toBeNull()
  })

  it('is OVERDUE from the first day after the deadline', () => {
    expect(classifyDeadline('2026-08-17', TODAY)).toBe(OVERDUE)
    expect(classifyDeadline('2026-01-01', TODAY)).toBe(OVERDUE)
  })

  it('treats the due day itself as due, not overdue', () => {
    expect(classifyDeadline(TODAY, TODAY)).toBe(1)
  })

  it('buckets each boundary day and the day after it', () => {
    expect(classifyDeadline('2026-08-19', TODAY)).toBe(1)
    expect(classifyDeadline('2026-08-20', TODAY)).toBe(7)
    expect(classifyDeadline('2026-08-25', TODAY)).toBe(7)
    expect(classifyDeadline('2026-08-26', TODAY)).toBe(30)
    expect(classifyDeadline('2026-09-17', TODAY)).toBe(30)
    expect(classifyDeadline('2026-09-18', TODAY)).toBeNull()
  })
})

describe('isMoreUrgent', () => {
  it('ranks OVERDUE above every day bucket', () => {
    expect(isMoreUrgent(OVERDUE, 1)).toBe(true)
    expect(isMoreUrgent(1, OVERDUE)).toBe(false)
  })

  it('ranks a tighter day bucket above a looser one', () => {
    expect(isMoreUrgent(7, 30)).toBe(true)
    expect(isMoreUrgent(30, 7)).toBe(false)
  })

  it('is strict — the same bucket is not an escalation', () => {
    expect(isMoreUrgent(7, 7)).toBe(false)
  })

  it('treats a never-notified row as escalating from nothing', () => {
    expect(isMoreUrgent(30, null)).toBe(true)
  })
})
