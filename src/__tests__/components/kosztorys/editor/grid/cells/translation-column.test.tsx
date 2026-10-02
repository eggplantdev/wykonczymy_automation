import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { translationColumn } from '@/components/kosztorys/editor/grid/cells/translation-column'
import { withSyntheticRows } from '@/components/kosztorys/editor/grid/kosztorys-synthetic-rows'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// Regression: the grid wraps every column in `withSyntheticRows`, which spreads the column's own
// `columnData` into an object. A bare language string came out the other side as an object, so the
// cell read nothing and a typed translation was saved under the key „[object Object]".
describe('translationColumn behind withSyntheticRows', () => {
  it('still resolves its language, so the saved text shows in the cell', () => {
    const column = withSyntheticRows(translationColumn('uk', 'UA'), {
      totals: new Map(),
      totalLabel: 'Razem',
      sectionHeader: {
        figures: new Map(),
        collapsedSectionIds: new Set<number>(),
        onToggleCollapsed: vi.fn(),
        sortActive: false,
        labelColumnId: 'description',
      },
      sectionFooter: { figures: new Map(), labelColumnId: 'description' },
    })
    const Cell = column.component as React.ComponentType<Record<string, unknown>>
    const rowData = {
      id: 1,
      sectionId: 1,
      description: 'mikrocement',
      descriptionTranslations: { uk: { text: 'мікроцемент', source: 'mikrocement' } },
    } as unknown as KosztorysV2RowT

    render(<Cell rowData={rowData} columnData={column.columnData} focus={false} />)

    expect(screen.getByText('мікроцемент')).toBeTruthy()
  })
})
