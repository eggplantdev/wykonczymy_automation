import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'

// What one investment's client sees. Its own table for the same reason `kosztorys-shares` is one:
// `kosztoryses` is the v1 Google-Sheet link row (required `googleSheetId`), so a v2 kosztorys has no
// row there at all, and a client-disclosure decision is not a property of the investment record.
//
// `variants` holds both column sets at once — `mode` picks the one the client's link serves, so
// moving an investment from offer to settlement is one field, not twenty re-ticked checkboxes.
// Each variant stores what is HIDDEN, not what is visible: `PREVIEW_VISIBLE_COLUMNS` stays the
// ceiling, so a column added to the allowlist later is served without rewriting a single stored row.
export const KosztorysClientView: CollectionConfig = {
  slug: 'kosztorys-client-view',
  labels: {
    singular: { en: 'Kosztorys Client View', pl: 'Ustawienia podglądu inwestora' },
    plural: { en: 'Kosztorys Client Views', pl: 'Ustawienia podglądu inwestora' },
  },
  admin: {
    useAsTitle: 'investment',
    defaultColumns: ['investment', 'mode', 'updatedAt'],
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
      name: 'mode',
      type: 'select',
      required: true,
      defaultValue: 'OFFER',
      options: [
        { value: 'OFFER', label: { en: 'Offer', pl: 'Oferta' } },
        { value: 'SETTLEMENT', label: { en: 'Settlement', pl: 'Rozliczenie' } },
      ],
    },
    {
      name: 'variants',
      type: 'json',
      defaultValue: {},
    },
  ],
}
