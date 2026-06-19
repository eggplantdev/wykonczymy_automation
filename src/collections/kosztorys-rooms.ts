import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'

// Luźny kalkulator metrażu pokoi (bez powiązania z pozycjami — jak zakładka
// "pokoje" w arkuszu). Formuły liczone w kodzie; tu trzymamy tylko wymiary.
export const KosztorysRooms: CollectionConfig = {
  slug: 'kosztorys-rooms',
  labels: {
    singular: { en: 'Kosztorys Room', pl: 'Pokój kosztorysu' },
    plural: { en: 'Kosztorys Rooms', pl: 'Pokoje kosztorysu' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'investment', 'floorM2'],
    group: { en: 'Kosztorys', pl: 'Kosztorys' },
  },
  hooks: {
    afterChange: [makeRevalidateAfterChange('kosztorysRooms')],
    afterDelete: [makeRevalidateAfterDelete('kosztorysRooms')],
  },
  access: {
    read: isAdminOrOwnerOrManager,
    create: isAdminOrOwnerOrManager,
    update: isAdminOrOwnerOrManager,
    delete: isAdminOrOwnerOrManager,
  },
  fields: [
    { name: 'investment', type: 'relationship', relationTo: 'investments', required: true },
    { name: 'name', type: 'text', label: { en: 'Name', pl: 'Nazwa' } },
    { name: 'floorM2', type: 'number' },
    { name: 'perimeter', type: 'number' },
    { name: 'height', type: 'number' },
    { name: 'wallM2', type: 'number' },
    { name: 'ceilingDecorM2', type: 'number' },
    { name: 'baseboardM', type: 'number' },
  ],
}
