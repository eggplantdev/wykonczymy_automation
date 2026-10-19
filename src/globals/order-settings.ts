import type { GlobalConfig } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerOrManager } from '@/access'

// Hidden, or /admin offers a second editor that skips the actions' validation and cache expiry.
export const OrderSettings: GlobalConfig = {
  slug: 'order-settings',
  label: { en: 'Order settings', pl: 'Zamówienia big bag / kontener' },
  admin: { hidden: true },
  access: {
    read: isAdminOrOwnerOrManager,
    update: isAdminOrOwner,
  },
  fields: [
    {
      name: 'bigBagPrice',
      type: 'number',
      required: true,
      min: 0,
      label: { en: 'Big bag price', pl: 'Cena big bag' },
    },
    {
      name: 'containerPrice',
      type: 'number',
      required: true,
      min: 0,
      label: { en: 'Container price', pl: 'Cena kontenera' },
    },
    // A `suppliers` row id — a save that drops row ids leaves it pointing at nothing.
    {
      name: 'defaultSupplierId',
      type: 'text',
      label: { en: 'Default supplier', pl: 'Domyślny dostawca' },
    },
    {
      name: 'suppliers',
      type: 'array',
      label: { en: 'Suppliers', pl: 'Dostawcy' },
      fields: [
        { name: 'name', type: 'text', required: true, label: { en: 'Name', pl: 'Nazwa' } },
        { name: 'phone', type: 'text', required: true, label: { en: 'Phone', pl: 'Telefon' } },
      ],
    },
  ],
}
