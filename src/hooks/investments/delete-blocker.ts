import type { Where } from 'payload'
import { excludingCancelled, makeDeleteBlocker } from '@/hooks/prevent-delete'

// For LABOR_COST / RABAT / LOSS an orphaned transaction is terminal: they carry no source register
// either, so a row stripped of `investment_id` is reachable from no investment and no kasa at all.
// Cancelled rows are exempt — see `excludingCancelled`. Shared by the hard delete and the trash
// action, so moving an investment to the trash refuses on exactly what a delete would.
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
