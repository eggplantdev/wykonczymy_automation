import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Column } from 'react-datasheet-grid'

import { withSyntheticRows } from '@/components/kosztorys/editor/grid/kosztorys-synthetic-rows'
import { sectionBandLabelColumnId } from '@/components/kosztorys/editor/grid/cells/section-header-cell'
import { sectionFooterLabelColumnId } from '@/components/kosztorys/editor/grid/cells/section-footer-cell'
import { formatNet } from '@/lib/kosztorys/format'
import { sectionFooterRowId, TOTALS_ROW_ID } from '@/lib/kosztorys/synthetic-rows'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

const KITCHEN = 3
const BATHROOM = 4

// The money axis plus one prose column and one chrome column — enough for a figure to land in the
// wrong one if the wrapper ever stopped keying on the column's own id.
const COLUMN_IDS = ['description', 'unit', 'valueNet', 'plannedValueNet', 'discount', 'actions']

const FIGURES = new Map([
  [
    KITCHEN,
    new Map([
      ['valueNet', 1200],
      ['plannedValueNet', 1500],
      ['discount', 100],
    ]),
  ],
  [BATHROOM, new Map([['valueNet', 800]])],
])

const TOTALS = new Map([
  ['valueNet', 2000],
  ['plannedValueNet', 1500],
])

function row(id: number, sectionId: number, sectionName: string) {
  return { id, sectionId, sectionName } as KosztorysV2RowT
}

// Stands in for the column's real cell, so a spec can tell "the wrapper delegated" from "the
// wrapper painted a synthetic row".
function BaseCell({ rowData }: { rowData: KosztorysV2RowT }) {
  return <span>pozycja {rowData.id}</span>
}

// dsg renders every column's cell against every row; this is that fan-out, minus the grid. Each cell
// is tagged with its column id, which is the claim under test: a figure has to be readable from the
// column it sits in, not from its position in the row.
function renderRow(rowData: KosztorysV2RowT, columnIds: readonly string[] = COLUMN_IDS) {
  const context = {
    sectionHeader: {
      figures: new Map(),
      collapsedSectionIds: new Set<number>(),
      onToggleCollapsed: vi.fn(),
      sortActive: false,
      labelColumnId: sectionBandLabelColumnId(columnIds),
    },
    sectionFooter: { figures: FIGURES, labelColumnId: sectionFooterLabelColumnId(columnIds) },
    totals: TOTALS,
  }
  const columns = columnIds.map((id) =>
    withSyntheticRows({ id, component: BaseCell } as unknown as Column<KosztorysV2RowT>, context),
  )

  render(
    <>
      {columns.map((column) => {
        const Cell = column.component as React.ComponentType<Record<string, unknown>>
        return (
          <div key={column.id} data-testid={column.id}>
            <Cell rowData={rowData} columnData={column.columnData} />
          </div>
        )
      })}
    </>,
  )
}

function cellText(columnId: string) {
  return screen.getByTestId(columnId).textContent
}

describe('section footer — a figure belongs to its column', () => {
  it('puts each of a section’s figures under that column and nothing under the others', () => {
    renderRow(row(sectionFooterRowId(KITCHEN), KITCHEN, 'Kuchnia'))

    expect(cellText('valueNet')).toBe(formatNet(1200))
    expect(cellText('plannedValueNet')).toBe(formatNet(1500))
    expect(cellText('discount')).toBe(formatNet(100))
    // No entry, no number — a column whose axis is hidden must not leave an orphan figure behind.
    expect(cellText('unit')).toBe('')
    expect(cellText('actions')).toBe('')
  })

  it('reads the figures of the section the row belongs to', () => {
    renderRow(row(sectionFooterRowId(BATHROOM), BATHROOM, 'Łazienka'))

    expect(cellText('valueNet')).toBe(formatNet(800))
    expect(cellText('plannedValueNet')).toBe('')
    expect(cellText('discount')).toBe('')
  })

  it('names the section in the „Opis prac" column', () => {
    renderRow(row(sectionFooterRowId(KITCHEN), KITCHEN, 'Kuchnia'))

    expect(cellText('description')).toBe('RazemKuchnia')
  })

  it('moves the name to „Sekcja" when „Opis prac" is hidden', () => {
    const columnIds = ['sectionName', 'valueNet', 'actions']
    renderRow(row(sectionFooterRowId(KITCHEN), KITCHEN, 'Kuchnia'), columnIds)

    expect(cellText('sectionName')).toBe('RazemKuchnia')
    expect(cellText('valueNet')).toBe(formatNet(1200))
  })
})

describe('„Razem" — the grand total under the same columns', () => {
  it('puts each total under its own column and the word where no total lands', () => {
    renderRow(row(TOTALS_ROW_ID, 0, ''))

    expect(cellText('valueNet')).toBe(formatNet(2000))
    expect(cellText('plannedValueNet')).toBe(formatNet(1500))
    expect(cellText('description')).toBe('Razem')
    expect(cellText('discount')).toBe('')
  })

  // A missing word beats a missing figure: the label column gives way when it carries a total.
  it('lets a total take the label column rather than dropping the figure', () => {
    renderRow(row(TOTALS_ROW_ID, 0, ''), ['valueNet', 'unit'])

    expect(cellText('valueNet')).toBe(formatNet(2000))
  })
})

describe('a real pozycja', () => {
  it('is handed to the column’s own cell untouched', () => {
    renderRow(row(41, KITCHEN, 'Kuchnia'))

    expect(cellText('valueNet')).toBe('pozycja 41')
    expect(cellText('description')).toBe('pozycja 41')
  })
})
