import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterMultiSelect } from '@/components/filters/filter-multi-select'

const toggle = (id: string, label: string, groupLabel?: string) => ({
  id,
  label,
  groupLabel,
  active: true,
  onToggle: vi.fn(),
})

const openMenu = (name: RegExp) => userEvent.click(screen.getByRole('button', { name }))

describe('FilterMultiSelect — wiersze przełączników', () => {
  it('renders a caller’s flat rows under no heading at all', async () => {
    render(
      <FilterMultiSelect
        label="Anulowane"
        toggles={[toggle('shown', 'Pokaż anulowane'), toggle('only', 'Tylko anulowane')]}
      />,
    )
    await openMenu(/^Anulowane/)

    expect(screen.getByRole('option', { name: 'Pokaż anulowane' })).toBeInTheDocument()
    const [onlyRun, ...rest] = screen.getAllByRole('group')
    expect(rest).toEqual([])
    expect(onlyRun).not.toHaveAccessibleName()
  })

  it('opens a new run wherever the heading changes', async () => {
    render(
      <FilterMultiSelect
        label="Filtry"
        toggles={[
          toggle('a', 'Pierwszy', 'Przedmiar'),
          toggle('b', 'Drugi', 'Przedmiar'),
          toggle('c', 'Trzeci', 'Komentarz'),
          toggle('d', 'Czwarty', 'Przedmiar'),
        ]}
      />,
    )
    await openMenu(/^Filtry/)

    const runs = screen.getAllByRole('group')
    expect(runs).toHaveLength(3)
    expect(runs[0]).toHaveTextContent('PierwszyDrugi')
    expect(runs[1]).toHaveTextContent('Trzeci')
    expect(runs[2]).toHaveTextContent('Czwarty')
  })

  it('sweeps from above the headings, not from inside the first axis', async () => {
    const onToggleAll = vi.fn()
    render(
      <FilterMultiSelect
        label="Filtry"
        toggles={[toggle('a', 'Pierwszy', 'Przedmiar')]}
        togglesBulk={{ allActive: true, onToggleAll }}
      />,
    )
    await openMenu(/^Filtry/)

    expect(screen.getByRole('group', { name: 'Przedmiar' })).not.toHaveTextContent(
      'Odznacz wszystkie',
    )

    await userEvent.click(screen.getByRole('option', { name: 'Odznacz wszystkie' }))
    expect(onToggleAll).toHaveBeenCalledWith(false)
  })
})
