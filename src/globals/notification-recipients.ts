import type { ArrayField, GlobalConfig } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerOrManager } from '@/access'

const recipientList = (name: string, label: { en: string; pl: string }): ArrayField => ({
  name,
  type: 'array',
  label,
  // `required` is load-bearing alongside `minRows`: Payload's array validator returns early on an
  // empty array when the field is optional, so `minRows: 1` on its own accepts `[]`.
  required: true,
  minRows: 1,
  fields: [{ name: 'email', type: 'text', required: true }],
})

/**
 * `admin: { hidden: true }` is load-bearing: leaving it visible in /admin would offer a second editor
 * for the same row that bypasses the action's validation and its cache invalidation.
 */
export const NotificationRecipients: GlobalConfig = {
  slug: 'notification-recipients',
  label: { en: 'Notification Recipients', pl: 'Odbiorcy powiadomień' },
  admin: { hidden: true },
  access: {
    read: isAdminOrOwnerOrManager,
    update: isAdminOrOwner,
  },
  fields: [
    recipientList('fleetDigest', { en: 'Fleet digest', pl: 'Powiadomienia o terminach' }),
    recipientList('newLead', { en: 'New lead', pl: 'Powiadomienia o nowych zgłoszeniach' }),
    recipientList('equipmentDigest', {
      en: 'Equipment digest',
      pl: 'Powiadomienia o gwarancjach sprzętu',
    }),
    recipientList('opsAlerts', { en: 'Ops alerts', pl: 'Alerty techniczne' }),
  ],
}
