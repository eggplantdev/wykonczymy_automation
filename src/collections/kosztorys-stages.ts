import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'
import { createUnlessInvestmentLocked, unlessInvestmentLocked } from '@/access/investment-lock'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'

// Deleting a stage that has recorded progress is blocked by removeStageAction, not at the collection
// level.
export const KosztorysStages: CollectionConfig = {
  slug: 'kosztorys-stages',
  labels: {
    singular: { en: 'Kosztorys Stage', pl: 'Etap kosztorysu' },
    plural: { en: 'Kosztorys Stages', pl: 'Etapy kosztorysu' },
  },
  admin: {
    useAsTitle: 'ordinal',
    defaultColumns: ['ordinal', 'label', 'investment'],
    group: { en: 'Kosztorys', pl: 'Kosztorys' },
  },
  hooks: {
    afterChange: [makeRevalidateAfterChange('kosztorysStages')],
    afterDelete: [makeRevalidateAfterDelete('kosztorysStages')],
  },
  access: {
    read: isAdminOrOwnerOrManager,
    create: createUnlessInvestmentLocked(isAdminOrOwnerOrManager, 'investment'),
    update: unlessInvestmentLocked(isAdminOrOwnerOrManager, 'investment'),
    delete: unlessInvestmentLocked(isAdminOrOwnerOrManager, 'investment'),
  },
  fields: [
    { name: 'investment', type: 'relationship', relationTo: 'investments', required: true },
    { name: 'ordinal', type: 'number', required: true },
    { name: 'label', type: 'text', label: { en: 'Label', pl: 'Nazwa' } },
    // null = defaulted to z narzędziami, unconfirmed (drives a warning).
    {
      name: 'plane',
      type: 'select',
      required: false,
      label: { en: 'Settlement plane', pl: 'Rozliczenie' },
      options: [
        { value: 'w_tools', label: { en: 'With tools', pl: 'Z narzędziami' } },
        { value: 'own_tools', label: { en: 'Without tools', pl: 'Bez narzędzi' } },
      ],
    },
    {
      name: 'splitMode',
      type: 'select',
      required: true,
      defaultValue: 'percent',
      label: { en: 'Split mode', pl: 'Podział' },
      options: [
        { value: 'percent', label: { en: 'Percent', pl: 'Procentowo' } },
        { value: 'amount', label: { en: 'Amount', pl: 'Kwotowo' } },
      ],
    },
    // Hides the investment from a worker whose every etap on it is completed and refuses his
    // reports; locks nothing (EX-1034).
    {
      name: 'completed',
      type: 'checkbox',
      defaultValue: false,
      label: { en: 'Completed', pl: 'Zakończony' },
    },
  ],
}
