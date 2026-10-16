import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { useWrapColumnWidths } from '@/components/kosztorys/editor/hooks/use-wrap-column-widths'
import { wrapColumnClass } from '@/lib/kosztorys/row-content-lines'
import type { GridTextSizeT } from '@/components/kosztorys/editor/hooks/use-grid-text-size'

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
    ({ ids, textSize = 'sm' }: { ids: readonly string[]; textSize?: GridTextSizeT }) =>
      useWrapColumnWidths({ current: container }, ids, textSize),
    {
      initialProps: { ids: columnIds } as { ids: readonly string[]; textSize?: GridTextSizeT },
    },
  )
}

function cellText(container: HTMLElement, fontSize: string) {
  const text = document.createElement('span')
  text.className = 'grid-cell-text'
  text.style.fontSize = fontSize
  container.append(text)
  return text
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

describe('useWrapColumnWidths — the font rows are fitted to', () => {
  it('follows the size the cells render at, so a smaller text size fits rows to fewer lines', async () => {
    const container = renderGrid([headerCell(wrapColumnClass('description'), 317)])
    const text = cellText(container, '14px')
    const { result, rerender } = renderWidths(container)
    await waitFor(() => expect(result.current.font).toContain('14px'))

    text.style.fontSize = '12px'
    rerender({ ids: COLUMN_IDS, textSize: 'xs' })

    await waitFor(() => expect(result.current.font).toContain('12px'))
    expect(result.current.widths.description).toBe(317 - CHROME)
  })

  // The object keys the row-height cache reset, so a needless new one would re-fit every row.
  it('returns the same object when the size is picked again unchanged', async () => {
    const container = renderGrid([headerCell(wrapColumnClass('description'), 317)])
    cellText(container, '14px')
    const { result, rerender } = renderWidths(container)
    await waitFor(() => expect(result.current.widths.description).toBe(317 - CHROME))
    const before = result.current

    rerender({ ids: COLUMN_IDS, textSize: 'sm' })
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    expect(result.current).toBe(before)
  })

  it('keeps the last font while no text node is rendered', async () => {
    const container = renderGrid([headerCell(wrapColumnClass('description'), 317)])
    const text = cellText(container, '12px')
    const { result } = renderWidths(container)
    await waitFor(() => expect(result.current.font).toContain('12px'))

    text.remove()
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    expect(result.current.font).toContain('12px')
  })
})
