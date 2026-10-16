import type { Where } from 'payload'
import { excludingCancelled, makeDeleteBlocker, type DeleteProbeT } from '@/lib/db/delete-blocker'
import { countStageMemberships } from '@/lib/db/stage-memberships'
import { countReportsByWorker } from '@/lib/db/worker-reports'
import { pendingDraftsHint, pendingDraftsProbe } from '@/lib/db/worker-expense-drafts'

const WORKER_USE_PROBES: readonly DeleteProbeT[] = [
  {
    collection: 'transactions',
    where: (id): Where =>
      excludingCancelled({
        or: [
          { worker: { equals: id } },
          { createdBy: { equals: id } },
          { updatedBy: { equals: id } },
        ],
      }),
    label: 'transakcje',
  },
  {
    collection: 'amount-edits',
    where: (id) => ({ editedBy: { equals: id } }),
    label: 'zmiany kwot',
  },
  {
    count: countStageMemberships,
    label: 'etapy kosztorysu',
  },
  // What he reported is the record of work he claims to have done; the CASCADE would erase it.
  {
    count: countReportsByWorker,
    label: 'zgłoszenia prac',
  },
  pendingDraftsProbe('worker'),
  // Deleting the row would erase the only answer to „who had it last" for anything still in that
  // person's hands.
  {
    collection: 'equipment-events',
    where: (id) => ({ holder: { equals: id } }),
    label: 'sprzęt',
  },
]

const message = (blockers: string[]) =>
  `Nie można usunąć pracownika — jest powiązany z danymi (${blockers.join(', ')}). Zamiast usuwać, odznacz „Aktywny".` +
  pendingDraftsHint(blockers)

/**
 * It leaves out the kasy the worker owns, because an EMPTY kasa goes to the trash with him.
 */
export const workerUseBlocker = makeDeleteBlocker({ probes: WORKER_USE_PROBES, message })

/**
 * `cash_registers.owner_id` is the only NOT NULL FK of them all — without the probe the delete fails
 * anyway, but with a raw 23502 instead of a sentence naming the kasa.
 */
export const workerDeleteBlocker = makeDeleteBlocker({
  probes: [
    ...WORKER_USE_PROBES,
    {
      collection: 'cash-registers',
      where: (id) => ({ owner: { equals: id } }),
      label: 'kasy',
    },
  ],
  message,
})
