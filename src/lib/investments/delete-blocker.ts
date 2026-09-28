import type { Where } from 'payload'
import { excludingCancelled, makeDeleteBlocker } from '@/lib/db/delete-blocker'

// For LABOR_COST / RABAT / LOSS an orphaned transaction is terminal: they carry no source register
// either, so a row stripped of `investment_id` is reachable from no investment and no kasa at all.
export const investmentDeleteBlocker = makeDeleteBlocker({
  probes: [
    {
      collection: 'transactions',
      where: (id): Where => excludingCancelled({ investment: { equals: id } }),
      label: 'transakcje',
    },
  ],
  message: (blockers) =>
    `Nie można usunąć inwestycji — istnieją powiązane dane (${blockers.join(', ')}). Najpierw usuń lub przenieś transakcje.`,
})
