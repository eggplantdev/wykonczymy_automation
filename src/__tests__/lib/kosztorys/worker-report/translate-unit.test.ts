import { describe, expect, it } from 'vitest'
import { translateUnit } from '@/lib/kosztorys/worker-report/translate-unit'

describe('translateUnit', () => {
  it.each([
    ['szt', 'шт.', 'шт.'],
    ['szt.', 'шт.', 'шт.'],
    ['m2', 'м²', 'м²'],
    ['m²', 'м²', 'м²'],
    ['M2', 'м²', 'м²'],
    ['m³', 'м³', 'м³'],
    ['mb', 'пог. м', 'пог. м'],
    ['m.b.', 'пог. м', 'пог. м'],
    ['kpl', 'компл.', 'компл.'],
    ['klp', 'компл.', 'компл.'],
    ['pkt', 'точ.', 'точ.'],
    ['kontener', 'контейнер', 'контейнер'],
    ['kg', 'кг', 'кг'],
    ['h', 'год.', 'ч'],
    ['godz.', 'год.', 'ч'],
  ])('reads „%s" as %s in Ukrainian and %s in Russian', (unit, uk, ru) => {
    expect(translateUnit(unit, 'uk')).toBe(uk)
    expect(translateUnit(unit, 'ru')).toBe(ru)
  })

  it('keeps a unit off the list as typed', () => {
    expect(translateUnit('big bag', 'uk')).toBe('big bag')
    expect(translateUnit('kW', 'ru')).toBe('kW')
  })

  it('keeps an empty unit empty', () => {
    expect(translateUnit('', 'uk')).toBe('')
  })

  it('shows a Polish worker the unit exactly as the owner typed it', () => {
    expect(translateUnit('m2', 'pl')).toBe('m2')
    expect(translateUnit('klp', 'pl')).toBe('klp')
  })
})
