import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  SectionHeaderCell,
  type SectionHeaderContextT,
} from '@/components/kosztorys/editor/grid/cells/section-header-cell'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

const SECTION_ID = 7

const ROW = {
  id: -1,
  sectionId: SECTION_ID,
  sectionName: 'Kuchnia',
  sectionColor: null,
} as unknown as KosztorysV2RowT

const onToggleCollapsed = vi.fn()
const onRename = vi.fn()

function context(collapsed: number[] = []): SectionHeaderContextT {
  return {
    figures: new Map([[SECTION_ID, { itemCount: 4, net: 0 }]]),
    collapsedSectionIds: new Set(collapsed),
    onToggleCollapsed,
    onRename,
    sortActive: false,
  }
}

function renderBand(collapsed: number[] = []) {
  const view = render(<SectionHeaderCell rowData={ROW} slot="label" context={context(collapsed)} />)
  return { ...view, user: userEvent.setup(), band: screen.getByRole('button', { name: /Kuchnia/ }) }
}

beforeEach(() => vi.clearAllMocks())

// The arrow is the only description of what's beneath it, so it must read the same collapsed-set
// the grid uses — under zwężenie that set is empty, so it says „rozwinięta" because the rows are
// on screen.
describe('Belka sekcji — strzałka mówi to, co widać', () => {
  it('stoi otwarta, gdy sekcja nie jest zwinięta', () => {
    const { band } = renderBand()

    expect(band).toHaveAttribute('aria-expanded', 'true')
    expect(band).toHaveAttribute('title', 'Zwiń sekcję')
  })

  it('stoi zamknięta, gdy sekcja jest zwinięta', () => {
    const { band } = renderBand([SECTION_ID])

    expect(band).toHaveAttribute('aria-expanded', 'false')
    expect(band).toHaveAttribute('title', 'Rozwiń sekcję')
  })
})

describe('Belka sekcji — zwijanie', () => {
  it('zwija kliknięciem w dowolne miejsce belki, nie tylko w strzałkę', async () => {
    const { user, band } = renderBand()

    await user.click(band)

    expect(onToggleCollapsed).toHaveBeenCalledExactlyOnceWith(SECTION_ID)
  })

  it('zwija Enterem i spacją, gdy belka ma ognisko', async () => {
    const { user, band } = renderBand()

    band.focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')

    expect(onToggleCollapsed).toHaveBeenCalledTimes(2)
  })

  // The name input sits inside the band; if the band caught keys leaving that field, typing a
  // space in „Kuchnia i jadalnia" would collapse the sekcja.
  it('nie łapie klawiszy wychodzących z pola nazwy', async () => {
    const { user } = renderBand()

    await user.click(screen.getByRole('textbox'))
    await user.keyboard('x y{Enter}')

    expect(onToggleCollapsed).not.toHaveBeenCalled()
  })

  it('nie zwija sekcji kliknięciem w jej nazwę', async () => {
    const { user } = renderBand()

    await user.click(screen.getByRole('textbox'))

    expect(onToggleCollapsed).not.toHaveBeenCalled()
  })
})

// A collapsed sekcja has to keep its own commands reachable („Rozwiń", „Usuń sekcję") — which is
// why the „Akcje" cell is the only one on the band that does not collapse.
describe('Belka sekcji — komórka akcji', () => {
  it('nie zwija sekcji i nie daje menu tam, gdzie nie ma poleceń', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <SectionHeaderCell rowData={ROW} slot="actions" context={context()} />,
    )

    await user.click(container.firstElementChild as Element)

    expect(onToggleCollapsed).not.toHaveBeenCalled()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
