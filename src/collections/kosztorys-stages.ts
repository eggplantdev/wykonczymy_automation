import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'

// Etap robót — dynamiczna "kolumna" wspólna dla wszystkich pozycji inwestycji.
// ordinal unikalny per inwestycja; label opcjonalny. Usunięcie etapu z wpisanym
// postępem blokuje akcja removeStage (nie collection-level).
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
