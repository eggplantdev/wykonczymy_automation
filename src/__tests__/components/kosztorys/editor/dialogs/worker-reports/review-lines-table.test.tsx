import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  ReviewLinesTable,
  type ReviewRowT,
} from '@/components/kosztorys/editor/dialogs/worker-reports/review-lines-table'
import type { LineDraftT } from '@/components/kosztorys/editor/dialogs/worker-reports/line-draft'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}))

const ORIGINAL = 'Монтаж плінтусів'

const extra = (patch: Partial<ReviewRowT> = {}): ReviewRowT => ({
  id: 1,
  kind: 'extra',
  itemId: undefined,
  description: ORIGINAL,
  unit: 'mb',
  sectionName: '',
  sectionColor: null,
  sectionOrder: 0,
  ref: undefined,
  reportedQty: 12,
  acceptedQty: undefined,
  createdItemId: undefined,
  catalogueItemId: undefined,
  polishDescription: undefined,
  descriptionLanguage: undefined,
  figures: undefined,
  itemDescription: undefined,
  workerDescription: undefined,
  workerDescriptionLanguage: undefined,
  isUnassigned: false,
  isAccepted: false,
  isFigureLive: false,
  isUncertain: false,
  scannedRef: undefined,
  isDuplicateItem: false,
  isUnitMissing: false,
  ...patch,
})

const draft: LineDraftT = {
  isTicked: false,
  qty: '12',
  itemId: undefined,
  isExtra: false,
  sectionId: '',
  unitPrice: '',
  catalogueId: undefined,
  matchedItemIds: [],
}

function renderTable(
  row: ReviewRowT,
  onRetranslate: ((lineId: number) => Promise<void>) | undefined,
) {
  return render(
    <ReviewLinesTable
      group="extra"
      rows={[row]}
      drafts={{ [row.id]: draft }}
      onChange={vi.fn()}
      sectionOptions={[]}
      itemOptions={[]}
      catalogue={[]}
      kosztorysItems={[]}
      onCatalogueSwap={vi.fn()}
      hintsByLine={{}}
      stageTitle="Etap 1"
      onRetranslate={onRetranslate}
    />,
  )
}

describe('praca spoza rozpiski — tłumaczenie dla kierownika', () => {
  it('a line the AI left untranslated says so and can be translated by hand', async () => {
    const onRetranslate = vi.fn().mockResolvedValue(undefined)
    renderTable(extra(), onRetranslate)

    expect(screen.getByText(ORIGINAL)).toBeInTheDocument()
    expect(screen.getByText('Brak tłumaczenia')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Przetłumacz' }))
    expect(onRetranslate).toHaveBeenCalledWith(1)
  })

  it('a translated line reads in Polish with the worker’s own words beside it', () => {
    renderTable(
      extra({
        polishDescription: 'Montaż listew przypodłogowych',
        descriptionLanguage: 'uk',
        workerDescription: ORIGINAL,
        workerDescriptionLanguage: 'uk',
      }),
      vi.fn(),
    )

    expect(screen.getByText('Montaż listew przypodłogowych')).toBeInTheDocument()
    expect(screen.getByText(ORIGINAL)).toBeInTheDocument()
    expect(screen.getByText('UA')).toBeInTheDocument()
    expect(screen.queryByText('Brak tłumaczenia')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Przetłumacz ponownie' })).toBeInTheDocument()
  })

  it('offers no translation once the report is decided or the line accepted', () => {
    const { unmount } = renderTable(extra(), undefined)
    expect(screen.queryByRole('button', { name: /Przetłumacz/ })).not.toBeInTheDocument()
    unmount()

    renderTable(extra({ isAccepted: true }), vi.fn())
    expect(screen.queryByRole('button', { name: /Przetłumacz/ })).not.toBeInTheDocument()
  })
})

const rozpiska = (patch: Partial<ReviewRowT>): ReviewRowT =>
  extra({ kind: 'rozpiska', itemId: 10, description: 'Malowanie ścian', unit: 'm2', ...patch })

function renderRozpiska(rows: ReviewRowT[], onChange = vi.fn()) {
  render(
    <ReviewLinesTable
      group="rozpiska"
      rows={rows}
      drafts={Object.fromEntries(rows.map((row) => [row.id, draft]))}
      onChange={onChange}
      sectionOptions={[]}
      itemOptions={[]}
      catalogue={[]}
      kosztorysItems={[]}
      onCatalogueSwap={vi.fn()}
      hintsByLine={{}}
      stageTitle="Etap 1"
      onRetranslate={undefined}
    />,
  )
  return onChange
}

describe('zgłoszenie z kartki — ostrzeżenia', () => {
  it('flags an uncertain read, a doubled pozycja and a number not in the rozpiska', () => {
    renderRozpiska([
      rozpiska({ id: 1, isUncertain: true }),
      rozpiska({ id: 2, isDuplicateItem: true }),
      rozpiska({ id: 3, itemId: undefined, isUnassigned: true, scannedRef: '35812' }),
    ])

    expect(screen.getByText('Niepewny odczyt — sprawdź na zdjęciu')).toBeInTheDocument()
    expect(screen.getByText('Ta pozycja jest w zgłoszeniu więcej niż raz')).toBeInTheDocument()
    expect(
      screen.getByText('Nr 35812 nie pasuje do rozpiski — do przypisania ręcznie'),
    ).toBeInTheDocument()
  })

  it('„Zaznacz wszystkie” leaves a doubled pozycja for the kierownik to pick', async () => {
    const onChange = renderRozpiska([
      rozpiska({ id: 1 }),
      rozpiska({ id: 2, isDuplicateItem: true }),
    ])

    await userEvent.click(screen.getByRole('checkbox', { name: 'Zaznacz wszystkie' }))

    expect(onChange).toHaveBeenCalledWith(1, { isTicked: true })
    expect(onChange).not.toHaveBeenCalledWith(2, expect.anything())
  })

  it('asks for a katalog praca when the scanned j.m. is missing', () => {
    renderTable(extra({ unit: '', isUnitMissing: true }), undefined)
    expect(
      screen.getByText('Brak j.m. w kosztorysie — wybierz pracę z katalogu'),
    ).toBeInTheDocument()
  })
})
