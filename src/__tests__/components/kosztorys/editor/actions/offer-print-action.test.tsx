import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DropdownMenu, DropdownMenuContent } from '@/components/ui/dropdown-menu'
import { GenerateOfferMenuItem } from '@/components/kosztorys/editor/actions/offer-print-action'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'
import { CTX, row } from '@/__tests__/lib/kosztorys/row-conditions/fixtures'

const toastMessage = vi.hoisted(() => vi.fn())
const readClientViewSettings = vi.hoisted(() => vi.fn())
const editorContext = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))
const actionsContext = vi.hoisted(() => ({ clientView: null as unknown }))

vi.mock('@/lib/utils/toast', () => ({ toastMessage }))
// `'use server'` module — vitest's stub throws on call, so the read is named explicitly.
vi.mock('@/lib/queries/client-view-settings-endpoint', () => ({ readClientViewSettings }))
vi.mock('@/components/kosztorys/editor/use-kosztorys-editor-context', () => ({
  useKosztorysEditorContext: () => editorContext.value,
}))
vi.mock('@/components/kosztorys/editor/actions/kosztorys-actions-context', () => ({
  useKosztorysActions: () => ({ investor: actionsContext }),
}))

function setRows(rows: KosztorysV2RowT[]) {
  editorContext.value = {
    investmentId: 7,
    rows,
    stages: CTX.stages,
    investmentName: 'Mieszkanie na Kazimierzu',
    columnTotals: new Map([['plannedNet', 1000]]),
    sectionColumnTotals: new Map(),
  }
}

async function clickOffer() {
  render(
    <DropdownMenu open>
      <DropdownMenuContent>
        <GenerateOfferMenuItem />
      </DropdownMenuContent>
    </DropdownMenu>,
  )
  await userEvent.click(screen.getByRole('menuitem', { name: /Wygeneruj ofertę w PDF/ }))
}

describe('GenerateOfferMenuItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actionsContext.clientView = null
    setRows([row({ id: 1, plannedQty: 10, clientPrice: 100 })])
  })

  it('pusta rozpiska nie otwiera okna — mówi, że nie ma czego drukować', async () => {
    setRows([])
    const open = vi.spyOn(window, 'open')

    await clickOffer()

    expect(open).not.toHaveBeenCalled()
    expect(toastMessage).toHaveBeenCalledWith('Brak pozycji do wydruku', 'info')
  })

  // jsdom returns null from window.open out of the box — the same answer a popup blocker gives.
  it('zablokowane okno kończy się komunikatem, nie cichym niczym', async () => {
    await clickOffer()

    expect(toastMessage).toHaveBeenCalledWith('Przeglądarka zablokowała okno wydruku', 'error')
  })

  it('nieudany odczyt ustawień zamyka okno i mówi o tym', async () => {
    const printWindow = { document: { title: '' }, close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(printWindow as unknown as Window)
    readClientViewSettings.mockRejectedValue(new Error('offline'))

    await clickOffer()
    await vi.waitFor(() => expect(printWindow.close).toHaveBeenCalled())

    expect(toastMessage).toHaveBeenCalledWith('Nie udało się odczytać ustawień podglądu', 'error')
  })

  it('konfiguracja już w ręku menu „Inwestor" oszczędza drugi odczyt', async () => {
    const printWindow = {
      document: { title: '', write: vi.fn(), close: vi.fn(), querySelector: () => null },
      addEventListener: vi.fn(),
      print: vi.fn(),
      close: vi.fn(),
    }
    vi.spyOn(window, 'open').mockReturnValue(printWindow as unknown as Window)
    actionsContext.clientView = {
      mode: 'SETTLEMENT',
      variants: {
        OFFER: { hiddenColumns: [], hideEmptyRows: true },
        SETTLEMENT: { hiddenColumns: ['price'], hideEmptyRows: false },
      },
    }

    await clickOffer()

    expect(readClientViewSettings).not.toHaveBeenCalled()
    // The OFFER variant, not the active SETTLEMENT one — „Cena j.m." is hidden only in the latter.
    expect(printWindow.document.write.mock.calls[0]![0]).toContain('Cena j.m.')
  })
})
