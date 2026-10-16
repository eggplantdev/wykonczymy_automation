import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'

export const CompanyKnowledge: CollectionConfig = {
  slug: 'company-knowledge',
  labels: {
    singular: { en: 'Company knowledge entry', pl: 'Wpis w Manualu' },
    plural: { en: 'Company knowledge', pl: 'Manual Wykończymy' },
  },
  admin: {
    useAsTitle: 'topic',
    defaultColumns: ['topic', 'displayOrder', 'updatedAt'],
  },
  defaultSort: 'displayOrder',
  hooks: {
    afterChange: [makeRevalidateAfterChange('companyKnowledge')],
    afterDelete: [makeRevalidateAfterDelete('companyKnowledge')],
  },
  access: {
    read: isAdminOrOwnerOrManager,
    create: isAdminOrOwnerOrManager,
    update: isAdminOrOwnerOrManager,
    delete: isAdminOrOwnerOrManager,
  },
  fields: [
    {
      name: 'topic',
      type: 'text',
      required: true,
      label: { en: 'Topic', pl: 'Temat' },
    },
    {
      name: 'content',
      type: 'textarea',
      required: true,
      label: { en: 'Content', pl: 'Treść' },
    },
    {
      name: 'displayOrder',
      type: 'number',
      required: true,
      defaultValue: 0,
    },
  ],
}
