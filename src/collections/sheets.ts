import type { CollectionConfig } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerOrManager } from '@/access'
import {
  createUnlessInvestmentLocked,
  unlessInvestmentLocked,
  updateUnlessInvestmentLocked,
} from '@/access/investment-lock'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'

export const Sheets: CollectionConfig = {
  slug: 'kosztoryses',
  labels: {
    singular: { en: 'Kosztorys', pl: 'Kosztorys' },
    plural: { en: 'Kosztoryses', pl: 'Kosztorysy' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'investment', 'googleSheetId'],
    group: { en: 'Finance', pl: 'Finanse' },
  },
  hooks: {
    // The investments listing reads hasSheet via a LEFT JOIN on kosztoryses, cached under the
    // investments tag — so a write here has to invalidate both.
    afterChange: [makeRevalidateAfterChange('kosztoryses', 'investments')],
    afterDelete: [makeRevalidateAfterDelete('kosztoryses', 'investments')],
  },
  // `not_equals` is what keeps the unlinked sheets editable: on a LEFT-JOINed nullable relationship
  // Payload emits `col IS NULL OR col <> …`, so a sheet naming no investment passes. `not_in` does
  // NOT behave this way.
  access: {
    read: isAdminOrOwnerOrManager,
    create: createUnlessInvestmentLocked(isAdminOrOwnerOrManager, 'investment'),
    update: updateUnlessInvestmentLocked(isAdminOrOwnerOrManager, 'investment'),
    delete: unlessInvestmentLocked(isAdminOrOwner, 'investment'),
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: { en: 'Name', pl: 'Nazwa' },
    },
    {
      name: 'googleSheetId',
      type: 'text',
      required: true,
      // The sheet id is the row's identity — duplicates would leave two kosztoryses fighting over one
      // materiały tab, orphan-detection deleting each other's rows.
      unique: true,
      label: { en: 'Google Sheet ID', pl: 'ID arkusza Google' },
      admin: {
        description: {
          en: 'Long string between /d/ and /edit in the sheet URL. Share the sheet with the Editor service account as Editor, and with the reader account as Viewer.',
          pl: 'Długi ciąg pomiędzy /d/ a /edit w URL arkusza. Udostępnij arkusz kontu zapisującemu jako Edytujący, a kontu czytającemu jako Przeglądający.',
        },
      },
    },
    {
      name: 'investment',
      type: 'relationship',
      relationTo: 'investments',
      hasMany: false,
      label: { en: 'Investment', pl: 'Inwestycja' },
    },
    {
      name: 'sheetColumnMapping',
      type: 'json',
      label: { en: 'Column mapping', pl: 'Wskazanie kolumn' },
      admin: {
        description: {
          en: 'Fallback only: field → column index, applied when the header text does not resolve a column. Matching by name always wins.',
          pl: 'Wyłącznie awaryjnie: pole → indeks kolumny, użyte gdy nazwa nagłówka nie rozpozna kolumny. Dopasowanie po nazwie zawsze wygrywa.',
        },
      },
    },
  ],
}
