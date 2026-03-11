import type { CollectionConfig } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerOrManager } from '@/access'
import { sanitizeFileName } from '@/lib/sanitize-filename'

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
    defaultColumns: ['filename', 'alt', 'createdAt'],
    group: { en: 'Finance', pl: 'Finanse' },
  },
  access: {
    read: () => true,
    create: isAdminOrOwnerOrManager,
    update: isAdminOrOwner,
    delete: isAdminOrOwner,
  },
  fields: [
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
