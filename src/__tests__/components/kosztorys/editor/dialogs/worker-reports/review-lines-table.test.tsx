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
  reportedQty: 12,
  acceptedQty: undefined,
  createdItemId: undefined,
  catalogueItemId: undefined,
  polishDescription: undefined,
  descriptionLanguage: undefined,
  figures: undefined,
  itemDescription: undefined,
  isUnassigned: false,
  isAccepted: false,
  isFigureLive: false,
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
      extra({ polishDescription: 'Montaż listew przypodłogowych', descriptionLanguage: 'uk' }),
      vi.fn(),
    )

    expect(screen.getByText('Montaż listew przypodłogowych')).toBeInTheDocument()
    expect(screen.getByText(`Zgłoszono (UA): „${ORIGINAL}”`)).toBeInTheDocument()
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
