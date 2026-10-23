import { formatPLDateTime } from '@/lib/utils/format-date'

export const formatDecision = (
  decidedAt: string | Date,
  decidedByName: string | null | undefined,
  locale?: string,
) => [formatPLDateTime(decidedAt, locale), decidedByName].filter(Boolean).join(' · ')
