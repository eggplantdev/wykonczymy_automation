import { describe, expect, it } from 'vitest'
import { COLUMN_LABELS } from '@/lib/kosztorys/column-config'
import { CLIENT_VIEW_GROUPS, PREVIEW_VISIBLE_COLUMNS } from '@/lib/kosztorys/client-view/columns'

// The groups ARE the allowlist, so the two can no longer disagree — what is left to guard is the
// flattening: a key repeated across groups renders two ticks for one column and collapses into the
// Set without a word, and a key with no label renders a row named after nothing.
describe('the client-view column groups', () => {
  const grouped = CLIENT_VIEW_GROUPS.flatMap((group) => group.keys)

  it('offers each allowlisted column exactly once', () => {
    expect(grouped).toHaveLength(PREVIEW_VISIBLE_COLUMNS.size)
  })

  it('names every row from the same source as the grid header', () => {
    for (const key of grouped) expect(COLUMN_LABELS[key]).toBeTypeOf('string')
  })
})
