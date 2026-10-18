import { TRANSFER_TYPE_LABELS } from '@/lib/constants/transfers'
import type { DetachedFileRowT } from '@/lib/db/media-detachments'
import { leadDisplayName } from '@/lib/leads/lead-display-name'
import { formatPLDate } from '@/lib/utils/format-date'

type ParentT = DetachedFileRowT['parent']

export function fileRestoreBlockedReason(parent: ParentT): string | undefined {
  if (parent.kind === 'investment' && parent.trashedAt)
    return 'Najpierw przywróć inwestycję z Kosza.'
  if (parent.kind === 'lead' && parent.trashedAt) return 'Najpierw przywróć zgłoszenie z Kosza.'
  return undefined
}

export function fileSourceLabel(parent: ParentT): string {
  if (parent.kind === 'investment') return `Inwestycja ${parent.name} · pliki`
  if (parent.kind === 'lead') return `Zgłoszenie ${leadDisplayName(parent)} · pliki`
  return `${TRANSFER_TYPE_LABELS[parent.type]} z ${formatPLDate(parent.date)} · faktura`
}

export function fileUploadTarget(parent: ParentT) {
  if (parent.kind === 'investment')
    return { collection: 'investments', field: 'assets', id: parent.id } as const
  if (parent.kind === 'lead')
    return { collection: 'leads', field: 'assets', id: parent.id } as const
  return { collection: 'transactions', field: 'invoice', id: parent.id } as const
}
