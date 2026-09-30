import type { Where } from 'payload'
import { excludingCancelled, makeDeleteBlocker } from '@/lib/db/delete-blocker'

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
  ],
  message: (blockers) =>
    `Nie można usunąć kasy — istnieją powiązane dane (${blockers.join(', ')}). Najpierw usuń lub przenieś transakcje.`,
})
