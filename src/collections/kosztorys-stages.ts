import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'

// A stage (etap) is a dynamic "column" shared by every item of an investment: an ordinal
// (unique per investment) plus an optional label. Deleting a stage that has recorded progress
// is blocked by removeStageAction, not at the collection level.
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
    create: isAdminOrOwnerOrManager,
    update: isAdminOrOwnerOrManager,
    delete: isAdminOrOwnerOrManager,
  },
  fields: [
    { name: 'investment', type: 'relationship', relationTo: 'investments', required: true },
    { name: 'ordinal', type: 'number', required: true },
    { name: 'label', type: 'text', label: { en: 'Label', pl: 'Nazwa' } },
  ],
}
