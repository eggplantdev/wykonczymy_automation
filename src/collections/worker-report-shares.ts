import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'

// The worker's one named link: his rozpiska with his rozliczenie, and the form he reports work
// through (EX-947, EX-966). A table of its own rather than a `worker` column on `kosztorys-shares`:
// the token alone decides which view opens, so no lookup branches on „investor or worker".
//
// Reports key on (investment, worker), never on this row, so revoking or rotating the link leaves
// every sent report untouched. The pair is unique in the migration, not here.
export const WorkerReportShares: CollectionConfig = {
  slug: 'worker-report-shares',
  labels: {
    singular: { en: 'Worker Report Share', pl: 'Link pracownika do zgłoszeń' },
    plural: { en: 'Worker Report Shares', pl: 'Linki pracowników do zgłoszeń' },
  },
  admin: {
    useAsTitle: 'token',
    defaultColumns: ['investment', 'worker', 'token', 'updatedAt'],
    group: { en: 'Kosztorys', pl: 'Kosztorys' },
  },
  // No revalidation hooks: the token lookup is uncached, so revoking bites on the next request.
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
      admin: { readOnly: true },
    },
  ],
}
