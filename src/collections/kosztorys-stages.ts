import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'
import { createUnlessInvestmentLocked, unlessInvestmentLocked } from '@/access/investment-lock'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'

// A stage (etap) is a dynamic "column" shared by every item of an investment: an ordinal
// (unique per investment) plus an optional label and a subcontractor tool-plane. Deleting a stage
// that has recorded progress is blocked by removeStageAction, not at the collection level.
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
    // Subcontractor tool-plane. null = defaulted to z narzędziami, unconfirmed (drives a warning);
    // an explicit pick writes the value. Not required — see the plane migration (EX-565).
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
    // How the etap's executed-work value is split between its workers (EX-943). The workers
    // themselves live in the raw `kosztorys_stage_workers` table, written only by
    // `updateStageSplitAction` together with this field.
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
  ],
}
