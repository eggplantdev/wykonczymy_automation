import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, type Mock } from 'vitest'

import { CatalogueMissingList } from '@/components/kosztorys/editor/dialogs/catalogue-missing-list'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import type { CatalogueMissingT, WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

type CatalogueNameT = { description: string; unit: string }

// Accepting a candidate is a WRITE dressed as a hint, and the two things that make it correct are
// invisible to the engine spec: that it carries the j.m. along with the opis, and that a praca whose
// name the cennik already holds is told the truth about why it is in this block.

const entry = (over: Partial<WorkCatalogueItemT> = {}): WorkCatalogueItemT => {
  const description = over.description ?? 'Montaż syfonów'
  const unit = over.unit ?? 'szt'
  return {
    id: 1,
    description,
    category: null,
    unit,
    clientPrice: 45,
    wToolsRate: null,
    wToolsRateCoeff: null,
    ownToolsRate: null,
    ownToolsRateCoeff: null,
    matchKey: catalogueKey(description, unit),
    ...over,
  }
}

const row = (over: Partial<CatalogueMissingT> = {}): CatalogueMissingT => ({
  itemId: 11,
  section: 'Łazienka',
  description: 'Montaż syfonów',
  unit: 'kpl',
  hints: [],
  ...over,
})

function renderList({
  missing,
  catalogue = [],
  readOnly = false,
  onAcceptName = vi.fn<(itemId: number, name: CatalogueNameT) => Promise<boolean>>(
    async () => true,
  ),
}: {
  missing: CatalogueMissingT[]
  catalogue?: WorkCatalogueItemT[]
  readOnly?: boolean
  onAcceptName?: Mock<(itemId: number, name: CatalogueNameT) => Promise<boolean>>
}) {
  render(
    <CatalogueMissingList
      missing={missing}
      catalogue={catalogue}
      readOnly={readOnly}
      onAcceptName={onAcceptName}
      onAddToCatalogue={vi.fn()}
    />,
  )
  return onAcceptName
}

describe('CatalogueMissingList — przyjęcie kandydata', () => {
  it('wysyła opis i j.m. kandydata, nie sam opis', async () => {
    const hint = { id: 7, description: 'Montaż syfonu', unit: 'szt', clientPrice: 45, score: 0.9 }
    const onAcceptName = renderList({ missing: [row({ hints: [hint] })] })

    await userEvent.click(screen.getByRole('button', { name: /Montaż syfonu/ }))

    expect(onAcceptName).toHaveBeenCalledWith(11, { description: 'Montaż syfonu', unit: 'szt' })
  })

  it('rozróżnia kandydatów jednostką i ceną, bo nazwy bywają identyczne', () => {
    renderList({
      missing: [
        row({
          hints: [
            { id: 7, description: 'Montaż syfonów', unit: 'szt', clientPrice: 45, score: 0.99 },
            { id: 8, description: 'Montaż syfonów', unit: 'm2', clientPrice: 60, score: 0.99 },
          ],
        }),
      ],
    })

    expect(screen.getByRole('button', { name: /Montaż syfonów.*szt.*45/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Montaż syfonów.*m2.*60/ })).toBeInTheDocument()
  })

  it('o pracy o tej samej nazwie mówi jednostką, a nie „może chodzi o"', () => {
    renderList({
      missing: [
        row({
          hints: [{ id: 7, description: 'Montaż syfonów', unit: 'szt', clientPrice: 45, score: 1 }],
        }),
      ],
    })

    expect(screen.getByText('ta sama nazwa, inna j.m.:')).toBeInTheDocument()
    expect(screen.queryByText('może chodzi o:')).not.toBeInTheDocument()
  })

  it('o pracy o innej nazwie mówi „może chodzi o"', () => {
    renderList({
      missing: [
        row({
          hints: [
            { id: 7, description: 'Montaż syfonu', unit: 'szt', clientPrice: 45, score: 0.9 },
          ],
        }),
      ],
    })

    expect(screen.getByText('może chodzi o:')).toBeInTheDocument()
  })

  it('daje wyjście do katalogu także pracy bez żadnego kandydata', async () => {
    const onAcceptName = renderList({
      missing: [row()],
      catalogue: [entry({ id: 9, description: 'Wylewki', unit: 'm2', clientPrice: 80 })],
    })

    await userEvent.click(screen.getByRole('button', { name: 'Wybierz z katalogu…' }))
    await userEvent.click(screen.getByRole('button', { name: /Wylewki/ }))

    expect(onAcceptName).toHaveBeenCalledWith(11, { description: 'Wylewki', unit: 'm2' })
  })

  it('zawęża wyszukiwarkę do wpisanej frazy', async () => {
    renderList({
      missing: [row()],
      catalogue: [
        entry({ id: 9, description: 'Wylewki', unit: 'm2' }),
        entry({ id: 10, description: 'Malowanie ścian', unit: 'm2' }),
      ],
    })

    await userEvent.click(screen.getByRole('button', { name: 'Wybierz z katalogu…' }))
    await userEvent.type(screen.getByPlaceholderText('Szukaj w katalogu...'), 'malow')

    expect(await screen.findByRole('button', { name: /Malowanie ścian/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Wylewki/ })).not.toBeInTheDocument()
  })

  it('czytelnikowi bez prawa zapisu pokazuje kandydata jako tekst, nie przycisk', () => {
    renderList({
      missing: [
        row({
          hints: [
            { id: 7, description: 'Montaż syfonu', unit: 'szt', clientPrice: 45, score: 0.9 },
          ],
        }),
      ],
      readOnly: true,
    })

    expect(screen.getByText(/Montaż syfonu/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
