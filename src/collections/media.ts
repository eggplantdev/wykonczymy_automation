import type { CollectionConfig } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'
import { preventReferencedMediaDelete } from '@/hooks/media/prevent-referenced-delete'
import { sanitizeFileName } from '@/lib/utils/sanitize-filename'
import type { MediaKindT } from '@/types/media'

// No default: rows predating the field are invoices by provenance, but stamping that guess on them
// is worse than a blank a human can read as „nobody said".
const KIND_OPTIONS: { label: { en: string; pl: string }; value: MediaKindT }[] = [
  { label: { en: 'Invoice', pl: 'Faktura' }, value: 'faktura' },
  { label: { en: 'Design', pl: 'Projekt' }, value: 'projekt' },
  { label: { en: 'Photo', pl: 'Zdjęcie' }, value: 'zdjecie' },
  { label: { en: 'Other', pl: 'Inne' }, value: 'inne' },
]

export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: { en: 'Media', pl: 'Plik' },
    plural: { en: 'Media', pl: 'Pliki' },
  },
  hooks: {
    beforeChange: [
      ({ data, req }) => {
        if (req.file?.name) {
          req.file.name = sanitizeFileName(req.file.name)
        }
        if (data.filename) {
          data.filename = sanitizeFileName(data.filename)
        }
        return data
      },
    ],
    // Hooks rather than the server action, against the usual preference: the admin panel writes
    // media straight through Payload, and `setTransferInvoice` drops the replaced file
    // fire-and-forget (unawaited), so an action-level invalidation would both miss the admin
    // path and race the delete. The collection is the one seam every writer crosses.
    afterChange: [makeRevalidateAfterChange('media')],
    // Bumps transfers too: the `transactions_rels` link is ON DELETE cascade, so deleting a media
    // row silently drops that page from every transfer pointing at it.
    afterDelete: [makeRevalidateAfterDelete('media', 'transfers')],
    beforeDelete: [preventReferencedMediaDelete],
  },
  upload: {
    staticDir: 'media',
    mimeTypes: ['image/*', 'application/pdf'],
    imageSizes: [
      {
        name: 'thumbnail',
        width: 400,
        height: 300,
        position: 'centre',
      },
    ],
    adminThumbnail: 'thumbnail',
  },
  admin: {
    defaultColumns: ['filename', 'kind', 'alt', 'createdAt'],
    group: { en: 'Finance', pl: 'Finanse' },
  },
  access: {
    read: () => true,
    create: isAdminOrOwnerOrManager,
    update: isAdminOrOwnerOrManager,
    delete: isAdminOrOwner,
  },
  fields: [
    {
      name: 'kind',
      type: 'select',
      options: KIND_OPTIONS,
      label: { en: 'Kind', pl: 'Rodzaj' },
    },
    {
      name: 'alt',
      type: 'text',
      label: { en: 'Alt Text', pl: 'Tekst alternatywny' },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      label: { en: 'Uploaded By', pl: 'Przesłane przez' },
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
      hooks: {
        beforeChange: [({ req, value }) => req.user?.id ?? value],
      },
    },
  ],
}
