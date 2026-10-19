import type { Field } from 'payload'

/**
 * Closed to access-checked writes: a REST PATCH would skip the checks the trash actions
 * (overrideAccess) run, and a client-supplied date could bring the 30-day purge forward.
 */
export const trashedAtField = (): Field => ({
  name: 'trashedAt',
  type: 'date',
  access: { create: () => false, update: () => false },
  admin: { hidden: true },
  label: { en: 'Trashed at', pl: 'W koszu od' },
})
