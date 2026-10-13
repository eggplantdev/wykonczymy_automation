import type { ParagonRefusalT } from '@/lib/db/worker-expense-drafts'
import { noticeFailure } from '@/lib/i18n/notice-failure'
import type { FailureT } from '@/types/action'

export const paragonRefusalFailure = (refusal: ParagonRefusalT): FailureT => ({
  ...(refusal.refusal === 'clash'
    ? noticeFailure('paragonsAlreadyDecided', {
        numbers: refusal.readRows.map((readRow) => readRow + 1).join(', '),
      })
    : noticeFailure('draftAlreadyDecided')),
  code: 'ALREADY_DECIDED',
})
