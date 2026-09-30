import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SheetImportDialog } from '@/components/kosztorys/editor/dialogs/sheet/sheet-import-dialog'
import type { ImportPreviewT } from '@/lib/actions/kosztorys-import'
import type { FooterComparisonT } from '@/lib/kosztorys/sheet-import/footer-totals'
import type { WorkerRefT } from '@/types/reference-data'

const applyKosztorysImport = vi.fn(async (..._args: unknown[]) => ({
  success: true as const,
  data: { sections: 2, items: 9, stages: 3 },
}))

vi.mock('@/lib/actions/kosztorys-import', () => ({
  applyKosztorysImport: (...args: unknown[]) => applyKosztorysImport(...args),
}))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const INVESTMENT_ID = 7

const MATCHING_TOTAL: FooterComparisonT = {
  key: 'plannedNet',
  label: 'wartość netto',
  sheetValue: 1000,
  appValue: 1000,
  delta: 0,
  matches: true,
  matchedAgainst: 'plannedNet',
}

// A clean read with etapy in it — the „Rozliczenie etapów" block only assembles when the sheet
// actually brought stages.
const PREVIEW: ImportPreviewT = {
  problems: [],
  columns: { missingFields: [], candidates: [], pointedFields: [] },
  failure: null,
  report: {
    missingColumns: [],
    counts: { sections: 2, items: 9, stages: 3 },
    rateDecisions: [],
    coeffs: { wTools: null, ownTools: null },
    dropped: [],
    totals: [MATCHING_TOTAL],
    warnings: [],
  },
}

const WORKERS: WorkerRefT[] = [
  { id: 5, name: 'Ekipa Nowak', active: true, role: 'EMPLOYEE', email: 'nowak@example.test' },
  { id: 6, name: 'Jan Kowalski', active: false, role: 'EMPLOYEE', email: 'jan@example.test' },
]

const NO_PLANE_LABEL = 'Nie ustawiaj — wybiorę w kosztorysie'
const W_TOOLS_LABEL = 'Wszystkie z narzędziami (podwykonawca)'

// Stands in for the editor, which mounts this dialog ONCE for both of its triggers — the whole risk
// is that closing it never unmounts it, so the pick has nowhere to go on its own.
function DialogHost() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Pobierz z arkusza</button>
      <SheetImportDialog
        investmentId={INVESTMENT_ID}
        workers={WORKERS}
        open={open}
        onOpenChange={setOpen}
        preview={PREVIEW}
        error={null}
        loaded
        onImported={vi.fn()}
        onMappingSaved={vi.fn()}
      />
    </>
  )
}

function renderDialog() {
  render(<DialogHost />)
  const user = userEvent.setup()
  // Radix mirrors the picked item's text into the trigger, so the trigger IS the current pick.
  const source = () => screen.getAllByRole('combobox')[0]
  const worker = () => screen.getAllByRole('combobox')[1]
  return {
    user,
    openDialog: () => user.click(screen.getByRole('button', { name: 'Pobierz z arkusza' })),
    source,
    worker,
    pickPlane: async (label: string) => {
      await user.click(source())
      await user.click(await screen.findByRole('option', { name: label }))
    },
    pickWorker: async (name: string) => {
      await user.click(worker())
      await user.click(await screen.findByRole('option', { name }))
    },
  }
}

beforeEach(() => vi.clearAllMocks())

// „Rozliczenie etapów" stamps every etap an import creates. The dialog never unmounts, so without
// a reset on open the pick outlives „Anuluj" — the next import would silently inherit one nobody
// chose this time.
describe('SheetImportDialog — the rozliczenie pick is per-opening', () => {
  it('opens on „nie ustawiaj"', async () => {
    const { openDialog, source } = renderDialog()

    await openDialog()

    expect(source()).toHaveTextContent(NO_PLANE_LABEL)
  })

  it('forgets a pick abandoned with „Anuluj"', async () => {
    const { user, openDialog, source, pickPlane } = renderDialog()

    await openDialog()
    await pickPlane(W_TOOLS_LABEL)
    expect(source()).toHaveTextContent(W_TOOLS_LABEL)

    await user.click(screen.getByRole('button', { name: 'Anuluj' }))
    await openDialog()

    expect(source()).toHaveTextContent(NO_PLANE_LABEL)
  })

  it('stamps the import with the pick made this time', async () => {
    const { user, openDialog, pickPlane } = renderDialog()

    await openDialog()
    await pickPlane(W_TOOLS_LABEL)
    await user.click(screen.getByRole('button', { name: 'Pobierz i zastąp' }))

    expect(applyKosztorysImport).toHaveBeenCalledWith(INVESTMENT_ID, 'w_tools', null)
  })

  it('sends no rozliczenie when the reopened dialog was left alone', async () => {
    const { user, openDialog, pickPlane } = renderDialog()

    await openDialog()
    await pickPlane(W_TOOLS_LABEL)
    await user.click(screen.getByRole('button', { name: 'Anuluj' }))

    await openDialog()
    await user.click(screen.getByRole('button', { name: 'Pobierz i zastąp' }))

    expect(applyKosztorysImport).toHaveBeenCalledWith(INVESTMENT_ID, null, null)
  })
})

describe('SheetImportDialog — one wykonawca for every imported etap', () => {
  it('sends the wykonawca picked alongside the rozliczenie', async () => {
    const { user, openDialog, pickPlane, pickWorker } = renderDialog()

    await openDialog()
    await pickPlane(W_TOOLS_LABEL)
    await pickWorker('Ekipa Nowak')
    await user.click(screen.getByRole('button', { name: 'Pobierz i zastąp' }))

    expect(applyKosztorysImport).toHaveBeenCalledWith(INVESTMENT_ID, 'w_tools', 5)
  })

  it('keeps the wykonawca locked until a rozliczenie is picked', async () => {
    const { openDialog, worker } = renderDialog()

    await openDialog()

    expect(worker()).toBeDisabled()
  })

  it('reads a re-picked wykonawca as none', async () => {
    const { user, openDialog, pickPlane, pickWorker, worker } = renderDialog()

    await openDialog()
    await pickPlane(W_TOOLS_LABEL)
    await pickWorker('Ekipa Nowak')
    await pickWorker('Ekipa Nowak')
    expect(worker()).toHaveTextContent('Bez przypisania')
    await user.click(screen.getByRole('button', { name: 'Pobierz i zastąp' }))

    expect(applyKosztorysImport).toHaveBeenCalledWith(INVESTMENT_ID, 'w_tools', null)
  })

  it('offers only active workers', async () => {
    const { user, openDialog, pickPlane, worker } = renderDialog()

    await openDialog()
    await pickPlane(W_TOOLS_LABEL)
    await user.click(worker())

    expect(await screen.findByRole('option', { name: 'Ekipa Nowak' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Jan Kowalski' })).not.toBeInTheDocument()
  })
})
