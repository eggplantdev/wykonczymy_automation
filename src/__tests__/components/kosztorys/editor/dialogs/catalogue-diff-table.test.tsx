import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CatalogueDiffTable } from '@/components/kosztorys/editor/dialogs/catalogue-diff-table'
import type {
  CatalogueFigureDiffT,
  CataloguePriceDiffT,
} from '@/lib/kosztorys/work-catalogue/types'

// Selecting is the risky half and none of it is visible to a node spec: a praca box that has to say
// „część", a selection that survives being sorted by maxDelta, and a licznik that must agree with
// what the write will carry.

const figure = (over: Partial<CatalogueFigureDiffT>): CatalogueFigureDiffT => ({
  label: 'Cena j.m.',
  field: 'clientPrice',
  kosztorys: 50,
  catalogue: 45,
  delta: 5,
  kosztorysIsAuto: false,
  catalogueIsAuto: false,
  ...over,
})

const DIFF: CataloguePriceDiffT = {
  itemId: 11,
  description: 'Gładzie gipsowe',
  unit: 'm2',
  clientPrice: 50,
  figures: [
    figure({}),
    figure({ label: 'Stawka z narzędziami', field: 'wToolsRate', kosztorys: 30, catalogue: 26 }),
    figure({ label: 'Stawka bez narzędzi', field: 'ownToolsRate', kosztorys: 20, catalogue: 18 }),
  ],
  maxDelta: 5,
}

const SECOND: CataloguePriceDiffT = {
  itemId: 12,
  description: 'Malowanie',
  unit: 'm2',
  clientPrice: 30,
  figures: [figure({ kosztorys: 30, catalogue: 28 })],
  maxDelta: 2,
}

function renderTable(diffs: CataloguePriceDiffT[], onApply = vi.fn().mockResolvedValue(true)) {
  render(
    <CatalogueDiffTable
      diffs={diffs}
      readOnly={false}
      onApply={onApply}
      onEditInCatalogue={vi.fn()}
    />,
  )
  return onApply
}

const applyButton = () => screen.getByRole('button', { name: /Aktualizuj kosztorys/ })

describe('CatalogueDiffTable — zaznaczanie', () => {
  it('zaznaczenie pracy bierze wszystkie jej liczby', async () => {
    renderTable([DIFF])

    await userEvent.click(screen.getByRole('checkbox', { name: 'Gładzie gipsowe' }))

    for (const label of ['Cena j.m.', 'Stawka z narzędziami', 'Stawka bez narzędzi'])
      expect(screen.getByRole('checkbox', { name: label })).toBeChecked()
    expect(applyButton()).toHaveTextContent('Aktualizuj kosztorys (3)')
  })

  it('odznaczenie jednej liczby zostawia pracę w stanie pośrednim', async () => {
    renderTable([DIFF])

    await userEvent.click(screen.getByRole('checkbox', { name: 'Gładzie gipsowe' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Cena j.m.' }))

    expect(screen.getByRole('checkbox', { name: 'Gładzie gipsowe' })).toHaveAttribute(
      'data-state',
      'indeterminate',
    )
    expect(applyButton()).toHaveTextContent('Aktualizuj kosztorys (2)')
  })

  it('„zaznacz wszystkie" przełącza całość w obie strony', async () => {
    renderTable([DIFF, SECOND])

    await userEvent.click(screen.getByRole('button', { name: 'Zaznacz wszystkie' }))
    expect(applyButton()).toHaveTextContent('Aktualizuj kosztorys (4)')

    await userEvent.click(screen.getByRole('button', { name: 'Odznacz wszystkie' }))
    expect(applyButton()).toBeDisabled()
    expect(applyButton()).toHaveTextContent('Aktualizuj kosztorys (0)')
  })

  it('oddaje zaznaczenie po pracy i po nazwie liczby, nie po etykiecie z raportu', async () => {
    const onApply = renderTable([DIFF])

    await userEvent.click(screen.getByRole('checkbox', { name: 'Stawka z narzędziami' }))
    await userEvent.click(applyButton())

    expect(onApply).toHaveBeenCalledWith([{ itemId: 11, fields: ['wToolsRate'] }])
  })

  it('czyści zaznaczenie po udanym zapisie i zostawia je po nieudanym', async () => {
    const onApply = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    renderTable([DIFF], onApply)

    await userEvent.click(screen.getByRole('checkbox', { name: 'Cena j.m.' }))
    await userEvent.click(applyButton())
    expect(applyButton()).toHaveTextContent('Aktualizuj kosztorys (1)')

    await userEvent.click(applyButton())
    expect(applyButton()).toHaveTextContent('Aktualizuj kosztorys (0)')
  })
})

describe('CatalogueDiffTable — sufit 65 %', () => {
  // The merged wiersz, not the stored one: the owner ticks in bulk and never opens a single praca,
  // so the warning has to appear on the selection and disappear with it.
  const OVER: CataloguePriceDiffT = {
    itemId: 21,
    description: 'Wylewki',
    unit: 'm2',
    clientPrice: 100,
    figures: [
      figure({ label: 'Stawka z narzędziami', field: 'wToolsRate', kosztorys: 50, catalogue: 80 }),
    ],
    maxDelta: 30,
  }

  it('ostrzega dopiero po zaznaczeniu stawki, która przekracza sufit', async () => {
    renderTable([OVER])

    expect(screen.queryByText(/przekracza/)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('checkbox', { name: 'Stawka z narzędziami' }))
    expect(screen.getByText(/przekracza/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('checkbox', { name: 'Stawka z narzędziami' }))
    expect(screen.queryByText(/przekracza/)).not.toBeInTheDocument()
  })

  it('mierzy sufit przeciw cenie, którą ten sam zapis wpisze', async () => {
    // 80 zł against the katalog's 150 zł is 53 % — over the stored 100 zł it would be 80 %, so the
    // warning only stays silent if the cena that is ALSO being written is the one it measures.
    renderTable([
      {
        ...OVER,
        figures: [figure({ kosztorys: 100, catalogue: 150 }), ...OVER.figures],
      },
    ])

    await userEvent.click(screen.getByRole('checkbox', { name: 'Wylewki' }))

    expect(screen.queryByText(/przekracza/)).not.toBeInTheDocument()
  })
})
