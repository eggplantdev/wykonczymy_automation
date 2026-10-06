import type { Where } from 'payload'
import { excludingCancelled, makeDeleteBlocker } from '@/lib/db/delete-blocker'
import { pendingDraftsHint, pendingDraftsProbe } from '@/lib/db/worker-expense-drafts'

// „Unused" for a kasa, spelled once: the hard delete, the trash, the purge and the owner lock all ask
// it. Cancelled rows are exempt — kasa balances are computed, never stored (`lib/db/sum-transfers.ts`),
// and every one of those sums already skips cancelled rows.
export const cashRegisterDeleteBlocker = makeDeleteBlocker({
  probes: [
    {
      collection: 'transactions',
      where: (id): Where =>
        excludingCancelled({
          or: [{ sourceRegister: { equals: id } }, { targetRegister: { equals: id } }],
        }),
      label: 'transakcje',
    },
    pendingDraftsProbe('cashRegister'),
  ],
  message: (blockers) =>
    `Nie można usunąć kasy — istnieją powiązane dane (${blockers.join(', ')}).` +
    (blockers.some((blocker) => blocker.startsWith('transakcje'))
      ? ' Najpierw usuń lub przenieś transakcje.'
      : '') +
    pendingDraftsHint(blockers),
})
