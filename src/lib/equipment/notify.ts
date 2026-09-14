import type { Payload } from 'payload'
import { FRONTEND_URL } from '@/lib/env'
import { daysLabel } from '@/lib/utils/deadline-label'
import { requireRecipients } from '@/lib/email/recipients'
import { section } from '@/lib/email/digest-section'
import { escapeHtml } from '@/lib/utils/escape-html'
import type { EquipmentDigestT, WarrantyEntryT } from '@/lib/equipment/digest'

/** Three „szlifierki" are a normal inventory, so a line that names only the model identifies nothing. */
const itemLabel = (entry: WarrantyEntryT): string =>
  [entry.name, entry.make, entry.model, entry.serialNumber].filter(Boolean).join(' ')

const warrantySection = (title: string, entries: readonly WarrantyEntryT[]): string =>
  section(
    title,
    entries,
    'table',
    (entry) => `<tr>
        <td><strong>${escapeHtml(itemLabel(entry))}</strong></td>
        <td>${escapeHtml(entry.warrantyUntil)}</td>
        <td>${escapeHtml(daysLabel(entry.daysLeft))}</td>
      </tr>`,
  )

/**
 * The daily digest, to the whole `equipmentDigest` list as ONE message with N addresses — not N
 * sends, so the bookkeeping stamp the caller writes afterwards still describes one delivery.
 *
 * Throws on send failure so the caller can skip stamping: a warranty marked "announced" by a mail
 * that never left goes quiet permanently. Throws for the same reason when the list is empty.
 */
export async function notifyEquipmentDigest(
  payload: Payload,
  digest: EquipmentDigestT,
): Promise<void> {
  const html = `
    <h2>Kończące się gwarancje</h2>
    ${warrantySection('W ciągu 7 dni', digest.within7)}
    ${warrantySection('W ciągu 30 dni', digest.within30)}
    <p><a href="${FRONTEND_URL}/sprzet">Otwórz sprzęt</a></p>
  `

  await payload.sendEmail({
    to: await requireRecipients(payload, 'equipmentDigest'),
    subject:
      digest.within7.length > 0
        ? `⚠️ Sprzęt — ${digest.within7.length} gwarancji kończy się w tym tygodniu — Wykończymy`
        : 'Sprzęt — kończące się gwarancje — Wykończymy',
    html,
  })
}
