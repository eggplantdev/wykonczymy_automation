import type { Payload } from 'payload'
import { FRONTEND_URL } from '@/lib/env'
import { requireRecipients } from '@/lib/email/recipients'
import { section } from '@/lib/email/digest-section'
import { escapeHtml } from '@/lib/utils/escape-html'
import { daysLabel } from '@/lib/utils/deadline-label'
import { INSPECTION_TYPE_LABELS } from '@/lib/fleet/inspection-types'
import { formatKm } from '@/lib/utils/format-distance'
import type { DigestEntryT, FleetDigestT, OdometerEntryT } from '@/lib/fleet/reminder-sweep'

/** Plate alone identifies a car to nobody but its keeper, so every line names the car too. */
const vehicleLabel = (entry: { registration: string; make: string; model: string }): string =>
  `${entry.registration} ${entry.make} ${entry.model}`.trim()

const deadlineTable = (title: string, entries: DigestEntryT[]): string =>
  section(
    title,
    entries,
    'table',
    (entry) => `<tr>
        <td><strong>${escapeHtml(vehicleLabel(entry))}</strong></td>
        <td>${escapeHtml(INSPECTION_TYPE_LABELS[entry.type].pl)}</td>
        <td>${escapeHtml(entry.nextDueAt)}</td>
        <td>${escapeHtml(daysLabel(entry.daysLeft))}</td>
      </tr>`,
  )

/**
 * Distance since the change and nothing else — the same figure the fleet table and the vehicle page
 * show, so one oil change never carries three numbers across three surfaces.
 */
const oilLabel = (entry: OdometerEntryT): string =>
  `przekroczony interwał wymiany oleju — ${formatKm(entry.kmSinceChange)} od ostatniej wymiany`

const odometerSection = (entries: OdometerEntryT[]): string =>
  section(
    'Wymiana oleju — limit kilometrów',
    entries,
    'ul',
    (entry) => `<li>
        <strong>${escapeHtml(vehicleLabel(entry))}</strong> — ${escapeHtml(oilLabel(entry))}.
      </li>`,
  )

const subjectFor = (digest: FleetDigestT): string => {
  if (digest.overdue.length > 0)
    return `🚨 Flota — ${digest.overdue.length} po terminie — Wykończymy`
  return 'Flota — nadchodzące terminy — Wykończymy'
}

/**
 * The daily digest, to the whole `fleetDigest` list as ONE message with N addresses — not N sends,
 * so the bookkeeping stamp the caller writes afterwards still describes one delivery.
 *
 * Throws on send failure so the caller can skip stamping: a deadline marked "announced" by a mail
 * that never left goes silent for a week. Throws for the same reason when the list is empty.
 */
export async function notifyFleetDigest(payload: Payload, digest: FleetDigestT): Promise<void> {
  const html = `
    <h2>Terminy floty</h2>
    ${deadlineTable('Po terminie', digest.overdue)}
    ${deadlineTable('W ciągu 7 dni', digest.within7)}
    ${odometerSection(digest.odometer)}
    <p><a href="${FRONTEND_URL}/flota">Otwórz flotę</a></p>
  `

  await payload.sendEmail({
    to: await requireRecipients(payload, 'fleetDigest'),
    subject: subjectFor(digest),
    html,
  })
}
