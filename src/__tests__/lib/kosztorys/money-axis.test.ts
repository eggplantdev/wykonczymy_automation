import { describe, expect, it } from 'vitest'

import { effectiveMoneyAxis } from '@/lib/kosztorys/money-axis'

describe('effectiveMoneyAxis', () => {
  it('honours the persisted pick in the client view', () => {
    expect(effectiveMoneyAxis('client', 'net')).toBe('net')
    expect(effectiveMoneyAxis('client', 'gross')).toBe('gross')
    expect(effectiveMoneyAxis('client', 'both')).toBe('both')
  })

  it('locks to netto on both subcontractor planes', () => {
    expect(effectiveMoneyAxis('w_tools', 'gross')).toBe('net')
    expect(effectiveMoneyAxis('own_tools', 'both')).toBe('net')
  })

  it('reads none as both under the client view', () => {
    expect(effectiveMoneyAxis('client', 'none')).toBe('both')
  })
})
