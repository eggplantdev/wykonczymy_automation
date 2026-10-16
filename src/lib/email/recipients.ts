import type { Payload } from 'payload'

export const RECIPIENT_LISTS = ['fleetDigest', 'equipmentDigest', 'newLead', 'opsAlerts'] as const

export type RecipientListT = (typeof RECIPIENT_LISTS)[number]

const LIST_LABELS: Record<RecipientListT, string> = {
  fleetDigest: 'powiadomienia o terminach floty',
  equipmentDigest: 'powiadomienia o gwarancjach sprzętu',
  newLead: 'powiadomienia o nowych zgłoszeniach',
  opsAlerts: 'alerty techniczne',
}

export type RecipientListsT = Record<RecipientListT, string[]>

export function byRecipientList<T>(
  valueOf: (list: RecipientListT) => T,
): Record<RecipientListT, T> {
  return Object.fromEntries(RECIPIENT_LISTS.map((list) => [list, valueOf(list)])) as Record<
    RecipientListT,
    T
  >
}

export async function readRecipientLists(payload: Payload): Promise<RecipientListsT> {
  const global = await payload.findGlobal({ slug: 'notification-recipients', depth: 0 })

  return byRecipientList((list) => (global[list] ?? []).map((row) => row.email))
}

/** Throws on an empty stream: mailing the void looks identical to a healthy run in every log. */
export async function requireRecipients(payload: Payload, list: RecipientListT): Promise<string[]> {
  const addresses = (await readRecipientLists(payload))[list]

  if (addresses.length === 0)
    throw new Error(`Brak odbiorców dla listy „${LIST_LABELS[list]}" — nie ma do kogo wysłać.`)

  return addresses
}
