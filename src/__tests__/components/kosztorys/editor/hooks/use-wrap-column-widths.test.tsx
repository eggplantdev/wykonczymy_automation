import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { useWrapColumnWidths } from '@/components/kosztorys/editor/hooks/use-wrap-column-widths'
import { wrapColumnClass } from '@/lib/kosztorys/row-content-lines'

// The cell's own chrome (border + px-2), subtracted from every measurement by the hook.
const CHROME = 17
const COLUMN_IDS = ['gutter', 'description', 'unit', 'note'] as const

function headerCell(classes: string, width: number) {
  const cell = document.createElement('div')
  cell.className = `dsg-cell dsg-cell-header ${classes}`
  cell.getBoundingClientRect = () => ({ width }) as DOMRect
  return cell
}

// dsg virtualizes columns horizontally, so the header holds the gutter plus whatever window is
// scrolled into view — never one cell per column, never in the column order.
function renderGrid(cells: readonly HTMLElement[]) {
  const container = document.createElement('div')
  const header = document.createElement('div')
  header.className = 'dsg-row dsg-row-header'
  cells.forEach((cell) => header.append(cell))
  container.append(header)
  document.body.append(container)
  return container
}

function renderWidths(container: HTMLElement, columnIds: readonly string[] = COLUMN_IDS) {
  return renderHook(
    ({ ids }: { ids: readonly string[] }) => useWrapColumnWidths({ current: container }, ids),
    {
      initialProps: { ids: columnIds },
    },
  )
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('useWrapColumnWidths — which cell a column is measured from', () => {
  it('finds each prose column by its class, not by its position in the header', async () => {
    const container = renderGrid([
      headerCell('', 40),
      headerCell(wrapColumnClass('note'), 217),
      headerCell('', 80),
      headerCell(wrapColumnClass('description'), 317),
    ])

    const { result } = renderWidths(container)

    await waitFor(() => expect(result.current.widths.description).toBe(317 - CHROME))
    expect(result.current.widths.note).toBe(217 - CHROME)
  })

  it('remeasures when the window resizes', async () => {
    const description = headerCell(wrapColumnClass('description'), 317)
    const container = renderGrid([description])
    const { result } = renderWidths(container)
    await waitFor(() => expect(result.current.widths.description).toBe(317 - CHROME))

    description.getBoundingClientRect = () => ({ width: 117 }) as DOMRect
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    expect(result.current.widths.description).toBe(117 - CHROME)
  })

  it('hands back the same object when nothing moved, so no row height is invalidated', async () => {
    const container = renderGrid([headerCell(wrapColumnClass('description'), 317)])
    const { result } = renderWidths(container)
    await waitFor(() => expect(result.current.widths.description).toBe(317 - CHROME))

    const before = result.current
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    expect(result.current).toBe(before)
  })
})

// EX-699: „Opis prac" leaves the DOM once the grid is scrolled past it, and a measurement taken then
// reads as „this text needs one line" — so the next fit flattened every row to 32px and saved it.
describe('useWrapColumnWidths — a column scrolled out of the horizontal window', () => {
  it('keeps the width it last measured when the header cell is gone', async () => {
    const description = headerCell(wrapColumnClass('description'), 317)
    const container = renderGrid([description])
    const { result } = renderWidths(container)
    await waitFor(() => expect(result.current.widths.description).toBe(317 - CHROME))

    description.remove()
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    expect(result.current.widths.description).toBe(317 - CHROME)
  })

  it('drops the width of a column the view stopped rendering altogether', async () => {
    const container = renderGrid([
      headerCell(wrapColumnClass('description'), 317),
      headerCell(wrapColumnClass('note'), 217),
    ])
    const { result, rerender } = renderWidths(container)
    await waitFor(() => expect(result.current.widths.note).toBe(217 - CHROME))

    rerender({ ids: ['gutter', 'description', 'unit'] })

    await waitFor(() => expect(result.current.widths.note).toBeUndefined())
    expect(result.current.widths.description).toBe(317 - CHROME)
  })
})
