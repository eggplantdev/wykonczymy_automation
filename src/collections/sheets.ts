import type { CollectionConfig } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerOrManager } from '@/access'
import {
  createUnlessInvestmentLocked,
  unlessInvestmentLocked,
  updateUnlessInvestmentLocked,
} from '@/access/investment-lock'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'

// A kosztorys (cost estimate) is a Google Sheet that mirrors an investment's
// expenses. It exists as its own row — separate from `investments` — so the
// owner can register/cost a sheet BEFORE the investment is confirmed and link
// the two later. `investment` is nullable and `ON DELETE SET NULL`: the sheet
// outlives the investment, becoming unlinked again if the investment is deleted.
// The 1:1 cardinality (one investment ↔ at most one kosztorys) is enforced by a
// partial unique index on investment_id (see 20260528_move_sheet_id_to_kosztoryses).
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
    // Bump `investments` too — the investments listing reads hasSheet via a
    // LEFT JOIN on kosztoryses (cached under the investments tag), so an
    // admin-panel edit / create / delete here must invalidate both caches.
    afterChange: [makeRevalidateAfterChange('kosztoryses', 'investments')],
    afterDelete: [makeRevalidateAfterDelete('kosztoryses', 'investments')],
  },
  // `not_equals` is what keeps the unlinked sheets editable: on a LEFT-JOINed nullable relationship
  // Payload emits `col IS NULL OR col <> …`, so a sheet naming no investment passes — which is
  // exactly what „Nowy kosztorys" produces. `not_in` does NOT behave this way.
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
      // The sheet id is the row's identity — duplicates would cause two kosztoryses
      // to fight over the same materiały tab (orphan-detection would delete each
      // other's rows). Postgres unique constraint enforced via Payload's `unique`.
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
      // Nullable: unlinked kosztoryses are first-class (planning before commit).
      // The partial unique index on investment_id WHERE NOT NULL enforces 1:1
      // when set — multiple NULLs are allowed.
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
