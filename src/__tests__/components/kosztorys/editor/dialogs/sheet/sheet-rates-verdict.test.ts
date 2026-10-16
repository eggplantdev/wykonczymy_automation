import { describe, expect, it } from 'vitest'
import { ratesVerdict } from '@/components/kosztorys/editor/dialogs/sheet/sheet-rates-verdict'
import type { StaleRateT } from '@/lib/kosztorys/sheet-import/build-sheet-comparison'
import type { ReportedRateResolutionT } from '@/lib/kosztorys/sheet-import/resolve-rates'

const decision = (kind: ReportedRateResolutionT['kind']) =>
  ({ kind, description: 'malowanie', wToolsRate: 10, ownToolsRate: 8 }) as ReportedRateResolutionT

const staleRate = () => ({ description: 'malowanie' }) as StaleRateT

describe('ratesVerdict', () => {
  it('says nothing about stawki when no cennik could be read at all', () => {
    expect(ratesVerdict('import', null, [staleRate()], 3)).toContain(
      'Nie odczytaliśmy żadnego cennika',
    )
  })

  it('reports agreement only when there is nothing to report', () => {
    expect(ratesVerdict('compare', [], [], 0)).toBe('Oba cenniki podały te same stawki.')
  })

  it('leads with the conflict when a praca is both conflicted and stale', () => {
    const verdict = ratesVerdict('import', [decision('conflict')], [staleRate()], 1)
    expect(verdict).toContain('Bez stawki wykonawcy wejdzie')
    expect(verdict).toContain('różni się')
  })

  it('still reports a stale stawka on its own', () => {
    const verdict = ratesVerdict('compare', [], [staleRate()], 0)
    expect(verdict).toContain('różni się')
    expect(verdict).not.toContain('cenniki podają różne kwoty')
  })

  it('drops the import tense in the comparison', () => {
    expect(ratesVerdict('compare', [decision('conflict')], [], 1)).not.toContain('wejdzie')
    expect(ratesVerdict('import', [decision('conflict')], [], 1)).toContain('wejdzie')
  })

  it('does not claim the cenniki disagreed about the resolved rows', () => {
    expect(ratesVerdict('import', [decision('single')], [], 0)).not.toContain('nie powiedziały')
  })
})
