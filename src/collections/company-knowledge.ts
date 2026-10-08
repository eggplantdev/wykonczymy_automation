import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'

// Company rules that belong to no single praca (EX-1032). Knowledge about one praca stays in the
// katalog's „Komentarz do pracy”, so one rule never has two homes.
export const CompanyKnowledge: CollectionConfig = {
  slug: 'company-knowledge',
  labels: {
    singular: { en: 'Company knowledge entry', pl: 'Wpis wiedzy firmowej' },
    plural: { en: 'Company knowledge', pl: 'Wiedza firmowa' },
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
