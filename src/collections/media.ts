import type { CollectionConfig } from 'payload'
import { isAdminOrOwner, isAuthenticated } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'
import { hardenMediaFileHeaders } from '@/hooks/media/harden-file-headers'
import { preventReferencedMediaDelete } from '@/hooks/media/prevent-referenced-delete'
import { ALLOWED_UPLOAD_MIMES } from '@/lib/media/sniff-mime'
import { sanitizeFileName } from '@/lib/utils/sanitize-filename'
import { MEDIA_KINDS, type MediaKindT } from '@/types/media'

const KIND_LABELS: Record<MediaKindT, { en: string; pl: string }> = {
  faktura: { en: 'Invoice', pl: 'Faktura' },
  projekt: { en: 'Design', pl: 'Projekt' },
  zdjecie: { en: 'Photo', pl: 'Zdjęcie' },
  inne: { en: 'Other', pl: 'Inne' },
}

const KIND_OPTIONS = MEDIA_KINDS.map((value) => ({ label: KIND_LABELS[value], value }))

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
    // `setTransferInvoice` drops the replaced file fire-and-forget (unawaited), so an action-level
    // invalidation would race the delete.
    afterChange: [makeRevalidateAfterChange('media')],
    // Bumps transfers too: the `transactions_rels` link is ON DELETE cascade, so deleting a media
    // row silently drops that page from every transfer pointing at it.
    afterDelete: [makeRevalidateAfterDelete('media', 'transfers')],
    beforeDelete: [preventReferencedMediaDelete],
  },
  upload: {
    staticDir: 'media',
    mimeTypes: [...ALLOWED_UPLOAD_MIMES],
    modifyResponseHeaders: hardenMediaFileHeaders,
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
    create: isAuthenticated,
    update: isAdminOrOwner,
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
