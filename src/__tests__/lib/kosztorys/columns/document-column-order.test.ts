import { describe, expect, it } from 'vitest'
import { clientDocumentColumns } from '@/lib/kosztorys/client-view/settings'
import { CLIENT_DOCUMENT_COLUMNS } from '@/lib/kosztorys/client-view/columns'
import { documentBaseRanks, orderDocumentKeys } from '@/lib/kosztorys/columns/document-column-order'
import { STAGES_COLUMN_GROUP } from '@/lib/kosztorys/stage-keys'
import { rankForMove } from '@/lib/table/column-order'

describe('orderDocumentKeys', () => {
  it('keeps „Opis prac" first even when it is ranked last', () => {
    expect(orderDocumentKeys(['description', 'unit', 'net'], { description: 99, unit: 5 })).toEqual(
      ['description', 'net', 'unit'],
    )
  })

  it('is the built-in order when nothing is ranked', () => {
    expect(clientDocumentColumns({})).toEqual(CLIENT_DOCUMENT_COLUMNS)
  })

  it('moves a stage family as one key', () => {
    const columns = clientDocumentColumns({ [STAGES_COLUMN_GROUP]: -1 })

    expect(columns.slice(0, 2)).toEqual(['description', STAGES_COLUMN_GROUP])
    expect(columns.filter((key) => key === STAGES_COLUMN_GROUP)).toHaveLength(1)
  })

  // The drag window feeds `rankForMove` the base ranks; counted with the pinned key included, every
  // drop would land one slot off.
  it('lands a drag where it was dropped when fed documentBaseRanks', () => {
    const rest = CLIENT_DOCUMENT_COLUMNS.filter((key) => key !== 'description')
    const rank = rankForMove(rest, 'plannedNet', 0, {}, documentBaseRanks(CLIENT_DOCUMENT_COLUMNS))

    expect(clientDocumentColumns({ plannedNet: rank }).slice(0, 2)).toEqual([
      'description',
      'plannedNet',
    ])
  })
})
