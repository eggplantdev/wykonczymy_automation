import type { GlobalConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'

// One column set for every worker link in the firm, with no per-investment override: the worker
// view is a working tool, not a document tailored per client. Stores what is HIDDEN, so the code
// allowlist (`WORKER_VIEW_GROUPS`) stays the ceiling and a column added to it later is served without
// rewriting this row.
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
      defaultValue: [],
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
