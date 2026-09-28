import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'

// One live named link per (investment, worker). A table of its own rather than a `worker` column on
// `kosztorys-shares`: the token alone decides which view opens, so no lookup has to branch on
// „investor or worker" — a branch whose mistake would serve a worker the client's prices.
//
// The pair is unique in the migration (`kosztorys_worker_shares_investment_worker_idx`), not here:
// Payload's `unique` is single-column. The public read resolves the token through the token-scoped
// query in `lib/queries/worker-kosztorys.ts`, never through these access rules.
export const KosztorysWorkerShares: CollectionConfig = {
  slug: 'kosztorys-worker-shares',
  labels: {
    singular: { en: 'Kosztorys Worker Share', pl: 'Link pracownika do kosztorysu' },
    plural: { en: 'Kosztorys Worker Shares', pl: 'Linki pracowników do kosztorysu' },
  },
  admin: {
    useAsTitle: 'token',
    defaultColumns: ['investment', 'worker', 'token', 'updatedAt'],
    group: { en: 'Kosztorys', pl: 'Kosztorys' },
  },
  // No revalidation hooks: the token lookup is deliberately uncached (revoking has to bite on the
  // next request), so nothing is stored under this collection's tag for a write to bust.
  access: {
    read: isAdminOrOwnerOrManager,
    create: isAdminOrOwnerOrManager,
    update: isAdminOrOwnerOrManager,
    delete: isAdminOrOwnerOrManager,
  },
  timestamps: true,
  fields: [
    {
      name: 'investment',
      type: 'relationship',
      relationTo: 'investments',
      required: true,
    },
    {
      name: 'worker',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'token',
      type: 'text',
      required: true,
      unique: true,
      // Minted by generateWorkerShareLinkAction — a hand-typed token would be guessable.
      admin: { readOnly: true },
    },
  ],
}
