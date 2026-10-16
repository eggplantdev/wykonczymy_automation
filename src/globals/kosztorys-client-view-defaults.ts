import type { GlobalConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'

export const KosztorysClientViewDefaults: GlobalConfig = {
  slug: 'kosztorys-client-view-defaults',
  label: { en: 'Client View Defaults', pl: 'Domyślne ustawienia podglądu inwestora' },
  admin: { group: { en: 'Kosztorys', pl: 'Kosztorys' } },
  access: {
    read: isAdminOrOwnerOrManager,
    update: isAdminOrOwnerOrManager,
  },
  fields: [
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
