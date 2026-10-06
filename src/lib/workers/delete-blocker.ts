import type { Where } from 'payload'
import { excludingCancelled, makeDeleteBlocker, type DeleteProbeT } from '@/lib/db/delete-blocker'
import { countStageMemberships } from '@/lib/db/stage-memberships'
import { countReportsByWorker } from '@/lib/db/worker-reports'
import { pendingDraftsHint, pendingDraftsProbe } from '@/lib/db/worker-expense-drafts'

// Block a hard delete while a FIGURE or its audit trail still names this person: a wypłata whose
// recipient is unknown, an amount edit with no editor, an etap with no podwykonawca. Deactivation
// (`active`) is the intended way for someone to leave; it keeps the row, so every past figure still
// says who it was about.
// Plain authorship is deliberately NOT a blocker — a media uploader, a snapshot's `takenBy`, a
// preset's `createdBy` name who touched something, not what a złotówka means, and blocking on them
// would freeze an account after one upload.
const WORKER_USE_PROBES: readonly DeleteProbeT[] = [
  {
    collection: 'transactions',
    // Cancelled rows are exempt — see `excludingCancelled`. Authorship is exempted with the rest, not
    // just `worker`: the delete is what erases the name, so refusing it over a cancelled row's
    // `createdBy` preserves no identity — it only makes the account undeletable. A cancelled row's
    // „Utworzone przez" going empty is the cost, and it is the same cost the row's live siblings
    // would impose by blocking the delete outright.
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
  // Not authorship: this names who was HOLDING a tool. Deleting the row would erase the only
  // answer to „who had it last" for anything still in that person's hands.
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
 * „Used" for a worker, spelled once: the trash, its delete forever and the purge all ask it. It leaves
 * out the kasy the worker owns, because an EMPTY kasa goes to the trash with him — the trash asks the
 * kasa's own blocker of each one instead.
 */
export const workerUseBlocker = makeDeleteBlocker({ probes: WORKER_USE_PROBES, message })

/**
 * The hard delete, from any route: use plus any kasa he still owns. `cash_registers.owner_id` is the
 * only NOT NULL FK of them all — without the probe the delete fails anyway, but with a raw 23502
 * instead of a sentence naming the kasa. Delete forever removes his trashed kasy first, in the same
 * transaction, so this count is zero by then.
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
