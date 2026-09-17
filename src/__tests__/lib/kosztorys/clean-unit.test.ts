import { describe, it, expect } from 'vitest'
import { cleanUnit } from '@/lib/kosztorys/clean-unit'
import { foldUnit } from '@/lib/kosztorys/sheet-import/columns'

describe('cleanUnit', () => {
  it('snaps a j.m. onto the spelling the combobox offers', () => {
    expect(cleanUnit('m2')).toBe('m²')
    expect(cleanUnit('m²')).toBe('m²')
    expect(cleanUnit('szt.')).toBe('szt')
    expect(cleanUnit('m.b.')).toBe('mb')
    expect(cleanUnit('  KPL ')).toBe('kpl')
  })

  it('straightens the transpositions no notation rule can reach', () => {
    expect(cleanUnit('klp')).toBe('kpl')
    expect(cleanUnit('KLP.')).toBe('kpl')
    expect(cleanUnit('kp')).toBe('kpl')
  })

  // Why the fix list is short: a wrong guess reprices a praca, so these surface in the katalog report
  // for a human instead.
  it('leaves alone what it cannot name, case included', () => {
    expect(cleanUnit('n2')).toBe('n2')
    expect(cleanUnit('180')).toBe('180')
    expect(cleanUnit('big bag')).toBe('big bag')
    expect(cleanUnit('kontener')).toBe('kontener')
    expect(cleanUnit('Mg')).toBe('Mg')
  })

  it('is idempotent, so the button survives being pressed twice', () => {
    for (const unit of ['szt.', 'm2', 'm²', 'klp', 'kp', 'big bag', 'Mg', 'n2', '', '  '])
      expect(cleanUnit(cleanUnit(unit))).toBe(cleanUnit(unit))
  })

  // Cleaning may change how a j.m. is SPELLED, never which praca it is — only the typo list is
  // allowed to move identity, and it moves it on purpose.
  it('leaves the matching identity untouched outside the typo list', () => {
    for (const unit of ['m2', 'm²', 'szt.', 'm.b.', 'KPL', 'big bag', 'Mg', 'n2'])
      expect(foldUnit(cleanUnit(unit))).toBe(foldUnit(unit))
  })
})
