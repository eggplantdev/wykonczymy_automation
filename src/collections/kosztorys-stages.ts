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
    create: createUnlessInvestmentLocked('investment'),
    update: unlessInvestmentLocked('investment.status'),
    delete: unlessInvestmentLocked('investment.status'),
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
    // Who is to do this etap (EX-613). Unlike `plane`, null is a legitimate resting state, not an
    // unconfirmed default: an unassigned etap gets its own residual row in the subcontractor
    // summary and its quantity entry stays open.
    {
      name: 'worker',
      type: 'relationship',
      relationTo: 'users',
      required: false,
      label: { en: 'Worker', pl: 'Pracownik' },
    },
  ],
}
