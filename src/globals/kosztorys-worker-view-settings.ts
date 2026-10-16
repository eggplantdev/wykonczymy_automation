import type { GlobalConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'

export const KosztorysWorkerViewSettings: GlobalConfig = {
  slug: 'kosztorys-worker-view-settings',
  label: { en: 'Worker View Settings', pl: 'Ustawienia widoku pracownika' },
  admin: { group: { en: 'Kosztorys', pl: 'Kosztorys' } },
  access: {
    read: isAdminOrOwnerOrManager,
    update: isAdminOrOwnerOrManager,
  },
  fields: [
    {
      name: 'hiddenColumns',
      type: 'json',
      defaultValue: {},
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
    {
      name: 'hidePlannedOnceExecuted',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
}
