import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'

export const ExpenseCategories: CollectionConfig = {
  slug: 'expense-categories',
  labels: {
    singular: { en: 'Investment Expense Type', pl: 'Typ wydatku inwestycyjnego' },
    plural: { en: 'Investment Expense Types', pl: 'Typy wydatków inwestycyjnych' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name'],
    group: { en: 'Finance', pl: 'Finanse' },
  },
  hooks: {
    afterChange: [makeRevalidateAfterChange('expenseCategories')],
    afterDelete: [makeRevalidateAfterDelete('expenseCategories')],
  },
  access: {
    read: isAdminOrOwnerOrManager,
    create: isAdminOrOwnerOrManager,
    update: isAdminOrOwnerOrManager,
    delete: isAdminOrOwnerOrManager,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      label: { en: 'Name', pl: 'Nazwa' },
    },
  ],
}
