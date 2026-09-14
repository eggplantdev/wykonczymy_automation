import type { ArrayField, GlobalConfig } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerOrManager } from '@/access'

// Addresses are free text, not a relation to `users`: somebody who should get the fleet digest does
// not thereby need an app account, and the two lists answer different questions.
const recipientList = (name: string, label: { en: string; pl: string }): ArrayField => ({
  name,
  type: 'array',
  label,
  // The "can't be empty" rule, enforced structurally — Payload applies it to every write path, so the
  // app's own action cannot forget it and neither can a future one. `required` is load-bearing
  // alongside `minRows`: Payload's array validator returns early on an empty array when the field is
  // optional, so `minRows: 1` on its own accepts `[]` — the exact case it exists to reject.
  required: true,
  minRows: 1,
  fields: [{ name: 'email', type: 'text', required: true }],
})

/**
 * Who gets notified, per stream. A global because there is exactly one of these firm-wide.
 *
 * `admin: { hidden: true }` is load-bearing: the lists are edited in the app, on the page whose
 * notifications they are (`/flota`, `/zgloszenia`), so that whoever reads that page can see who is
 * being told. Leaving it visible in /admin would offer a second editor for the same row that
 * bypasses the action's validation and its cache invalidation.
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
