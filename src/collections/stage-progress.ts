import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'

// Quantity done of an item in a stage. Sparse — a missing row means 0. The upsert by
// (item, stage) is done in setStageProgressAction via raw SQL ON CONFLICT.
export const StageProgress: CollectionConfig = {
  slug: 'stage-progress',
  labels: {
    singular: { en: 'Stage Progress', pl: 'Postęp etapu' },
    plural: { en: 'Stage Progress', pl: 'Postępy etapów' },
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['item', 'stage', 'qtyDone'],
    group: { en: 'Kosztorys', pl: 'Kosztorys' },
  },
  hooks: {
    afterChange: [makeRevalidateAfterChange('stageProgress')],
    afterDelete: [makeRevalidateAfterDelete('stageProgress')],
  },
  access: {
    read: isAdminOrOwnerOrManager,
    create: isAdminOrOwnerOrManager,
    update: isAdminOrOwnerOrManager,
    delete: isAdminOrOwnerOrManager,
  },
  fields: [
    { name: 'item', type: 'relationship', relationTo: 'kosztorys-items', required: true },
    { name: 'stage', type: 'relationship', relationTo: 'kosztorys-stages', required: true },
    { name: 'qtyDone', type: 'number', required: true, defaultValue: 0 },
  ],
}
