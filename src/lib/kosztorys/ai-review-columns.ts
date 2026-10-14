import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

export const AI_REVIEW_COLUMN_IDS = [
  'aiPlannedQty',
  'aiPlannedNet',
  'aiComment',
  'aiNewInformation',
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

// Each round appends „Label: answer” lines; split at the first colon so an answer may carry its own.
export const aiNewInformationLines = (text: string | null | undefined) =>
  (text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const colon = line.indexOf(': ')
      return colon > 0
        ? { label: line.slice(0, colon), answer: line.slice(colon + 2).trim() }
        : { label: null, answer: line }
    })
