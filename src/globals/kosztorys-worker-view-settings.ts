import type { GlobalConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'

// One column set for every worker link in the firm, with no per-investment override: the worker
// view is a working tool, not a document tailored per client. Stores one choice per column —
// `{ key: hidden }` — under the code allowlist (`WORKER_VIEW_GROUPS`) as the ceiling; a column the map
// does not mention reads as its code default, so one added later needs no rewrite of this row.
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
