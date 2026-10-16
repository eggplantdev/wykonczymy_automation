import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'

// No default on `hiddenColumns` — absent means „never chosen" and resolves to the whole code default
// (`sanitizeClientViewSettings`).
export const KosztorysClientView: CollectionConfig = {
  slug: 'kosztorys-client-view',
  labels: {
    singular: { en: 'Kosztorys Client View', pl: 'Ustawienia podglądu inwestora' },
    plural: { en: 'Kosztorys Client Views', pl: 'Ustawienia podglądu inwestora' },
  },
  admin: {
    useAsTitle: 'investment',
    defaultColumns: ['investment', 'updatedAt'],
    group: { en: 'Kosztorys', pl: 'Kosztorys' },
  },
  // No revalidation hooks: the settings are read outside the preview's `unstable_cache` entry, so a
  // save is live on the next request and no tag holds a copy for a write to bust.
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
      name: 'hiddenColumns',
      type: 'json',
    },
    {
      name: 'columnRanks',
      type: 'json',
    },
    {
      name: 'hideEmptyRows',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
}
