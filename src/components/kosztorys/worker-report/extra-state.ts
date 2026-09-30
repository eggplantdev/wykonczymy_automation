import type { ExtraWorkT } from '@/components/kosztorys/worker-report/types'
import { parseReportQty } from '@/lib/kosztorys/worker-report/parse-report-qty'

// An untouched row is skipped like an empty pozycja; a half-filled one blocks the send, since
// dropping it silently would lose work he meant to report.
export function extraState(extra: ExtraWorkT): 'blank' | 'complete' | 'invalid' {
  const qty = parseReportQty(extra.qty)
  if (extra.description.trim() === '' && extra.unit === '' && qty.kind === 'empty') return 'blank'
  if (extra.description.trim() !== '' && extra.unit !== '' && qty.kind === 'value')
    return 'complete'
  return 'invalid'
}

export const blankExtra = (): ExtraWorkT => ({
  key: crypto.randomUUID(),
  description: '',
  unit: '',
  qty: '',
})
