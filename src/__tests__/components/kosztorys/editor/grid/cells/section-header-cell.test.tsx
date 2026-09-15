import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  SectionHeaderCell,
  type SectionHeaderContextT,
} from '@/components/kosztorys/editor/grid/cells/section-header-cell'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

const SECTION_ID = 10
const SECTION_NAME = 'Prace ziemne'

const ROW = {
  id: 1,
  sectionId: SECTION_ID,
  sectionName: SECTION_NAME,
  sectionColor: null,
} as unknown as KosztorysV2RowT

function renderBand(overrides: Partial<SectionHeaderContextT> = {}) {
  const onToggleCollapsed = vi.fn()
  const onRename = vi.fn()
  const context: SectionHeaderContextT = {
    figures: new Map([[SECTION_ID, { itemCount: 3, net: 1200 }]]),
    collapsedSectionIds: new Set(),
    onToggleCollapsed,
    onRename,
    sortActive: false,
    ...overrides,
  }
  render(<SectionHeaderCell rowData={ROW} slot="label" context={context} />)
  return { onToggleCollapsed, onRename, user: userEvent.setup() }
}

// The band is a role=button wrapping the rename input, so every key pressed while renaming also
// reaches the band's own handler. That collision shipped once (2026-09-14): Space collapsed the
// section instead of typing a space, and it went unguarded because the repo had no DOM renderer.
describe('SectionHeaderCell — rename input vs. the band it sits inside', () => {
  it('types a space into the name instead of collapsing the section', async () => {
    const { onToggleCollapsed, user } = renderBand()
    const input = screen.getByDisplayValue(SECTION_NAME)

    await user.click(input)
    await user.keyboard(' dodatkowe')

    expect(input).toHaveValue(`${SECTION_NAME} dodatkowe`)
    expect(onToggleCollapsed).not.toHaveBeenCalled()
  })

  it('commits the rename on Enter without collapsing the section', async () => {
    const { onToggleCollapsed, onRename, user } = renderBand()
    const input = screen.getByDisplayValue(SECTION_NAME)

    await user.click(input)
    await user.keyboard(' II{Enter}')

    expect(onRename).toHaveBeenCalledWith(SECTION_ID, `${SECTION_NAME} II`)
    expect(onToggleCollapsed).not.toHaveBeenCalled()
  })

  it('drops the draft on Escape', async () => {
    const { onToggleCollapsed, onRename, user } = renderBand()
    const input = screen.getByDisplayValue(SECTION_NAME)

    await user.click(input)
    await user.keyboard(' II{Escape}')

    expect(onRename).not.toHaveBeenCalled()
    expect(onToggleCollapsed).not.toHaveBeenCalled()
  })

  it('still collapses on Space when the band itself holds focus', async () => {
    const { onToggleCollapsed, user } = renderBand()
    const band = screen.getByRole('button')

    band.focus()
    await user.keyboard(' ')

    expect(onToggleCollapsed).toHaveBeenCalledWith(SECTION_ID)
  })

  it('renders the name as static text when renaming is off (client view)', () => {
    renderBand({ onRename: undefined })

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText(SECTION_NAME)).toBeInTheDocument()
  })
})

describe('SectionHeaderCell — what a collapsed band still states', () => {
  it('reports its collapsed state and keeps showing the count and the net', () => {
    renderBand({ collapsedSectionIds: new Set([SECTION_ID]) })

    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('(3 poz.)')).toBeInTheDocument()
    expect(screen.getByText(/netto/)).toBeInTheDocument()
  })
})
