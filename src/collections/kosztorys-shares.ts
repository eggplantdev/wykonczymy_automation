import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'

// The public read NEVER goes through this collection's access control — it resolves the token via
// the token-scoped query in `lib/queries/preview-kosztorys.ts`.
export const KosztorysShares: CollectionConfig = {
  slug: 'kosztorys-shares',
  labels: {
    singular: { en: 'Kosztorys Share', pl: 'Udostępnienie kosztorysu' },
    plural: { en: 'Kosztorys Shares', pl: 'Udostępnienia kosztorysu' },
  },
  admin: {
    useAsTitle: 'token',
    defaultColumns: ['investment', 'token', 'updatedAt'],
    group: { en: 'Kosztorys', pl: 'Kosztorys' },
  },
  // No revalidation hooks: the token lookup is deliberately uncached (revoking has to bite on the
  // next request), so nothing is stored under a `kosztorys-shares` tag for a write to bust.
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
      unique: true,
    },
    {
      name: 'token',
      type: 'text',
      required: true,
      unique: true,
      // Minted by `writeShareToken` — a hand-typed token would be guessable.
      admin: { readOnly: true },
    },
  ],
}
