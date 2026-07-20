import type { CollectionConfig } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'

// One live public link per investment's kosztorys. Its own table rather than a column on an
// existing entity: revoke is a row delete, and sharing gets a lifecycle (expiry, multiple links)
// without touching a core entity. `kosztoryses` could not hold it — that slug is the v1
// Google-Sheet link row, whose `googleSheetId` is required, so a v2 kosztorys with no linked
// sheet has no row there at all.
//
// The public read NEVER goes through this collection's access control — it resolves the token via
// the token-scoped query in `lib/queries/client-kosztorys.ts`. These rules govern the admin panel
// and the share actions only. No row for an investment ⇒ no public access.
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
  hooks: {
    afterChange: [makeRevalidateAfterChange('kosztorysShares')],
    afterDelete: [makeRevalidateAfterDelete('kosztorysShares')],
  },
  access: {
    read: isAdminOrOwnerOrManager,
    create: isAdminOrOwner,
    update: isAdminOrOwner,
    delete: isAdminOrOwner,
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
      // Minted by generateShareLinkAction — a hand-typed token would be guessable.
      admin: { readOnly: true },
    },
  ],
}
