import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { canManageAccount, canViewRegister, MANAGEMENT_ROLES, type RoleT } from '@/lib/auth/roles'
import { getDb } from '@/lib/db/get-db'
import { ENTITY_TRASH_RETENTION_DAYS, FILE_TRASH_RETENTION_DAYS } from '@/lib/constants/trash'
import { fetchTrashedInvestments, type TrashedInvestmentRowT } from '@/lib/db/investment-trash'
import {
  fetchTrashedCashRegisters,
  type TrashedCashRegisterRowT,
} from '@/lib/db/cash-register-trash'
import { fetchTrashedWorkers, type TrashedWorkerRowT } from '@/lib/db/worker-trash'
import { fetchTrashedVehicles, type TrashedVehicleRowT } from '@/lib/db/vehicle-trash'
import { fetchTrashedEquipment, type TrashedEquipmentRowT } from '@/lib/db/equipment-trash'
import { fetchTrashedLeads, type TrashedLeadRowT } from '@/lib/db/lead-trash'
import { fetchTrashedTemplates, type TrashedTemplateRowT } from '@/lib/db/template-trash'
import { fetchDetachedFiles, type DetachedFileRowT } from '@/lib/db/media-detachments'
import { leadDisplayName } from '@/lib/leads/lead-display-name'
import { LEAD_SOURCE_LABELS } from '@/lib/leads/lead-source-labels'
import { TRANSFER_TYPE_LABELS } from '@/lib/constants/transfers'
import { canViewDetachedFile, fileRestoreBlockedReason } from '@/lib/media/file-trash'
import { formatPLDate } from '@/lib/utils/format-date'
import { makeModel } from '@/lib/utils/make-model'
import type { TrashRowT } from '@/types/trash'

const DAY_MS = 24 * 60 * 60 * 1000

type TrashListsT = {
  investments: TrashedInvestmentRowT[]
  templates: TrashedTemplateRowT[]
  cashRegisters: TrashedCashRegisterRowT[]
  workers: TrashedWorkerRowT[]
  vehicles: TrashedVehicleRowT[]
  equipment: TrashedEquipmentRowT[]
  leads: TrashedLeadRowT[]
  files: DetachedFileRowT[]
}

export function shapeTrashRows(
  {
    investments,
    templates,
    cashRegisters,
    workers,
    vehicles,
    equipment,
    leads,
    files,
  }: TrashListsT,
  { viewerRole, now }: { viewerRole: RoleT; now: number },
): TrashRowT[] {
  const daysLeft = (trashedAt: Date, retentionDays: number) =>
    Math.max(0, Math.ceil((trashedAt.getTime() + retentionDays * DAY_MS - now) / DAY_MS))

  const base = (
    row: { id: number; trashedAt: Date },
    retentionDays = ENTITY_TRASH_RETENTION_DAYS,
  ) => ({
    id: row.id,
    trashedAt: row.trashedAt,
    daysLeft: daysLeft(row.trashedAt, retentionDays),
    autoPurges: true,
    hasSheet: false,
    pairedRegisters: [] as string[],
  })

  return [
    ...investments.map((row) => ({
      ...base(row),
      kind: 'investment' as const,
      name: row.name,
      autoPurges: !row.isKosztorysUsed && !row.isUndeletable,
      hasSheet: row.hasSheet,
    })),
    ...templates.map((row) => ({ ...base(row), kind: 'template' as const, name: row.name })),
    ...cashRegisters
      .filter((row) => canViewRegister(viewerRole, row.type))
      .map((row) => ({ ...base(row), kind: 'cash-register' as const, name: row.name })),
    ...workers
      .filter((row) => canManageAccount(viewerRole, row.role))
      .map((row) => ({
        ...base(row),
        kind: 'worker' as const,
        name: row.name,
        pairedRegisters: row.registerNames,
      })),
    ...vehicles.map((row) => ({
      ...base(row),
      kind: 'vehicle' as const,
      name: row.registration,
      detail: makeModel(row) || undefined,
    })),
    ...equipment.map((row) => ({
      ...base(row),
      kind: 'equipment' as const,
      name: row.name,
      detail:
        [makeModel(row), row.serialNumber && `nr ser. ${row.serialNumber}`]
          .filter(Boolean)
          .join(' · ') || undefined,
    })),
    ...leads.map((row) => ({
      ...base(row),
      kind: 'lead' as const,
      name: leadDisplayName(row),
      detail: [LEAD_SOURCE_LABELS[row.source], row.submittedAt && formatPLDate(row.submittedAt)]
        .filter(Boolean)
        .join(' · '),
    })),
    ...files
      .filter(({ parent }) => canViewDetachedFile(viewerRole, parent))
      .map((row) => ({
        ...base({ id: row.id, trashedAt: row.detachedAt }, FILE_TRASH_RETENTION_DAYS),
        kind: 'file' as const,
        name: row.filename,
        detail: fileSourceLabel(row.parent),
        restoreBlockedReason: fileRestoreBlockedReason(row.parent),
      })),
  ]
}

function fileSourceLabel(parent: DetachedFileRowT['parent']): string {
  if (parent.kind === 'investment') return `Inwestycja ${parent.name} · pliki`
  if (parent.kind === 'lead') return `Zgłoszenie ${leadDisplayName(parent)} · pliki`
  return `${TRANSFER_TYPE_LABELS[parent.type]} z ${formatPLDate(parent.date)} · faktura`
}

// Uncached: the page is rare, and its „used" flag reads kosztorys tables no trash tag covers.
export async function getTrashContents(): Promise<TrashRowT[]> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error(session.error)

  const payload = await getPayload({ config })
  const db = await getDb(payload)
  const [investments, templates, cashRegisters, workers, vehicles, equipment, leads, files] =
    await Promise.all([
      fetchTrashedInvestments(db),
      fetchTrashedTemplates(db),
      fetchTrashedCashRegisters(db),
      fetchTrashedWorkers(db),
      fetchTrashedVehicles(db),
      fetchTrashedEquipment(db),
      fetchTrashedLeads(db),
      fetchDetachedFiles(db),
    ])

  return shapeTrashRows(
    { investments, templates, cashRegisters, workers, vehicles, equipment, leads, files },
    { viewerRole: session.user.role, now: Date.now() },
  )
}
