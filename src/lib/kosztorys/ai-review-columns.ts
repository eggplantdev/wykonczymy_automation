import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

export const AI_REVIEW_COLUMN_IDS = [
  'aiPlannedQty',
  'aiPlannedNet',
  'aiComment',
  'reviewStatus',
  'changeReason',
  'workNote',
] as const

const AI_COMMENT_LINES = [
  ['Czego nie było wiadomo', 'aiMissingData'],
  ['Co / ile założono', 'aiAssumptions'],
] as const

// The draft lists one item per line; in the cell they would run on into each other, so they read as
// one comma-separated answer.
export const aiCommentLines = (row: Pick<KosztorysV2RowT, 'aiMissingData' | 'aiAssumptions'>) =>
  AI_COMMENT_LINES.flatMap(([question, field]) => {
    const answer = (row[field] ?? '')
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
      .join(', ')
    return answer ? [{ field, question, answer }] : []
  })
