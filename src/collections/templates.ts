import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'

// A szablon: katalog prac references grouped into sections, in order (EX-1075). Writes go through
// the template actions (`lib/actions/template-*.ts`, raw SQL), so the collection is read-only — it
// exists for the generated types and for REST reads by the AI kosztorys scripts.
//
// The name is unique on `lower(trim(name))` INCLUDING trashed szablony (a migration index, since
// Payload's `unique` is exact-match only): a restore from the kosz must never collide.
// `content_edited_at` is a raw column the template gate stamps on every content write; it is not a
// field, so Payload never touches it.
export const Templates: CollectionConfig = {
  slug: 'templates',
  labels: {
    singular: { en: 'Template', pl: 'Szablon' },
    plural: { en: 'Templates', pl: 'Szablony' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'updatedAt'],
    group: { en: 'Kosztorys', pl: 'Kosztorys' },
  },
  access: {
    read: isAdminOrOwnerOrManager,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'name', type: 'text', required: true, label: { en: 'Name', pl: 'Nazwa' } },
    {
      name: 'trashedAt',
      type: 'date',
      access: { create: () => false, update: () => false },
      admin: { hidden: true },
      label: { en: 'Trashed at', pl: 'W koszu od' },
    },
  ],
}
