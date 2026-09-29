import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { UncataloguedUsageList } from '@/components/work-catalogue/uncatalogued-usage-list'
import type { UncataloguedUsageT } from '@/lib/kosztorys/work-catalogue/types'

const groups: UncataloguedUsageT[] = [
  {
    key: 'montaz syfonu|szt',
    description: 'Montaż syfonu',
    unit: 'szt',
    kosztorysCount: 4,
    hints: [{ id: 1, description: 'Montaż syfonów', unit: 'szt', clientPrice: 80, score: 0.9 }],
  },
  {
    key: 'fugowanie|mb',
    description: 'Fugowanie',
    unit: 'mb',
    kosztorysCount: 1,
    hints: [],
  },
]

async function renderOpen() {
  render(<UncataloguedUsageList groups={groups} />)
  await userEvent.click(screen.getByRole('button', { name: /Używane, a brak w katalogu \(2\)/ }))
}

describe('UncataloguedUsageList', () => {
  it('lists the groups in the order given, each with its kosztorys count', async () => {
    await renderOpen()
    const names = screen.getAllByText(/^(Montaż syfonu|Fugowanie)$/).map((node) => node.textContent)
    expect(names).toEqual(['Montaż syfonu', 'Fugowanie'])
    expect(screen.getByText('kosztorysy: 4')).toBeInTheDocument()
    expect(screen.getByText('kosztorysy: 1')).toBeInTheDocument()
  })

  it('shows candidates as read-only text, and none under a group without hints', async () => {
    await renderOpen()
    expect(screen.getByText('Montaż syfonów')).toBeInTheDocument()
    expect(screen.getAllByText('może chodzi o:')).toHaveLength(1)
    const fugowanie = screen.getByText('Fugowanie').closest('div.border-t')
    if (!(fugowanie instanceof HTMLElement)) throw new Error('no Fugowanie group')
    expect(within(fugowanie).queryByText('może chodzi o:')).toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })
})
