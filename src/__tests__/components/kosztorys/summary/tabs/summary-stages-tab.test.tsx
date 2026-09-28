import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SummaryStagesTab } from '@/components/kosztorys/summary/tabs/summary-stages-tab'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'
import { row } from '@/__tests__/lib/kosztorys/row-conditions/fixtures'

const editorContext = vi.hoisted(() => ({ rows: [] as KosztorysV2RowT[] }))
vi.mock('@/components/kosztorys/editor/use-kosztorys-editor-context', () => ({
  useKosztorysEditorContext: () => ({ doneNet: 0, plannedNet: 0, rows: editorContext.rows }),
}))

const STAGES: KosztorysStageT[] = [
  { id: 1, ordinal: 1, label: 'Tynki', plane: null, workerId: null },
  { id: 2, ordinal: 2, label: 'Malowanie', plane: null, workerId: null },
]

function renderTab(rows: KosztorysV2RowT[], preview: boolean) {
  editorContext.rows = rows
  render(
    <SummaryStagesTab
      stages={STAGES}
      stageTotals={new Map([[1, 400]])}
      executedNet={400}
      sectionSubtotals={[]}
      vatRate={0.08}
      preview={preview}
    />,
  )
}

describe('SummaryStagesTab', () => {
  it('lists only the etapy with entries to the investor', () => {
    renderTab([row({ [stageKey(1)]: 4 })], true)

    expect(screen.getByText('Tynki')).toBeInTheDocument()
    expect(screen.queryByText('Malowanie')).not.toBeInTheDocument()
  })

  it('reads „Brak etapów." to the investor while nothing is entered', () => {
    renderTab([row()], true)

    expect(screen.getByText('Brak etapów.')).toBeInTheDocument()
    expect(screen.queryByText('Tynki')).not.toBeInTheDocument()
  })

  // The owner plans etapy before any work is booked against them, so their tab keeps the empty ones.
  it('keeps every etap on the owner’s tab', () => {
    renderTab([row()], false)

    expect(screen.getByText('Tynki')).toBeInTheDocument()
    expect(screen.getByText('Malowanie')).toBeInTheDocument()
  })
})
