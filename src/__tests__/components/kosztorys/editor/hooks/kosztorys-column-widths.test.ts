import { describe, expect, it } from 'vitest'
import { dropKeys } from '@/hooks/create-json-map-store'

describe('dropKeys', () => {
  const widths = { stage_7: 100, stageValueNet_7: 120, stageValueGross_7: 140, description: 300 }

  it('usuwa wszystkie kolumny etapu naraz, nie ruszając reszty', () => {
    expect(dropKeys(widths, ['stage_7', 'stageValueNet_7', 'stageValueGross_7'])).toEqual({
      description: 300,
    })
  })

  it('usuwa te id, które są przypięte, i ignoruje nieprzypięte', () => {
    expect(dropKeys(widths, ['stage_7', 'stage_99'])).toEqual({
      stageValueNet_7: 120,
      stageValueGross_7: 140,
      description: 300,
    })
  })

  it('nie mutuje wejścia', () => {
    dropKeys(widths, ['stage_7'])
    expect(widths.stage_7).toBe(100)
  })

  it('brak trafień → ta sama referencja (sygnał „nie zapisuj")', () => {
    expect(dropKeys(widths, ['stage_99'])).toBe(widths)
    expect(dropKeys(widths, [])).toBe(widths)
  })
})
