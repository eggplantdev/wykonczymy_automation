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

describe('FilterMultiSelect — lista opcji: zaznacz, co chcesz widzieć', () => {
  const OPTIONS = [
    { value: 'a', label: 'Alfa' },
    { value: 'b', label: 'Beta' },
  ]

  const renderOptions = (values: string[] = [], props = {}) => {
    const onValuesChange = vi.fn()
    render(
      <FilterMultiSelect
        label="Typ"
        options={OPTIONS}
        values={values}
        onValuesChange={onValuesChange}
        {...props}
      />,
    )
    return onValuesChange
  }

  // The selection is debounced and flushed when the panel closes.
  const pick = async (...labels: string[]) => {
    await openMenu(/^Typ/)
    for (const label of labels) await userEvent.click(screen.getByRole('option', { name: label }))
    await userEvent.keyboard('{Escape}')
  }

  it('opens unfiltered with nothing ticked and no badge', async () => {
    renderOptions()
    expect(screen.getByRole('button', { name: 'Typ' })).toBeInTheDocument()
    await openMenu(/^Typ/)
    expect(screen.queryByRole('option', { name: 'Wyczyść' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /wszystkie/ })).not.toBeInTheDocument()
  })

  it('emits exactly the ticked value', async () => {
    const onValuesChange = renderOptions()
    await pick('Alfa')
    expect(onValuesChange).toHaveBeenLastCalledWith(['a'])
  })

  it('emits every value when every option is ticked, not the unfiltered []', async () => {
    const onValuesChange = renderOptions()
    await pick('Alfa', 'Beta')
    expect(onValuesChange).toHaveBeenLastCalledWith(['a', 'b'])
  })

  it('emits [] once the last tick comes off', async () => {
    const onValuesChange = renderOptions(['a'])
    await pick('Alfa')
    expect(onValuesChange).toHaveBeenLastCalledWith([])
  })

  it('counts the ticks on the trigger and clears them with „Wyczyść"', async () => {
    const onValuesChange = renderOptions(['a', 'b'])
    expect(screen.getByRole('button', { name: 'Typ (2)' })).toBeInTheDocument()
    await pick('Wyczyść')
    expect(onValuesChange).toHaveBeenLastCalledWith([])
  })

  it('reads a link saved under the old „nothing selected" marker as unfiltered', () => {
    renderOptions(['__none__'])
    expect(screen.getByRole('button', { name: 'Typ' })).toBeInTheDocument()
  })

  it('keeps the select-all pair for a caller that asks for it', async () => {
    const onValuesChange = renderOptions([], {
      bulkLabels: { select: 'Rozwiń wszystkie', deselect: 'Zwiń wszystkie' },
    })
    await pick('Rozwiń wszystkie')
    expect(onValuesChange).toHaveBeenLastCalledWith(['a', 'b'])
  })
})
