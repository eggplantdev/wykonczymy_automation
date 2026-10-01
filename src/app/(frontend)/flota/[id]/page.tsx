import { notFound, redirect } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { STREAMS, markSeen } from '@/lib/db/notifications'
import { fetchVehicleDetail } from '@/lib/queries/fleet'
import { AddInspectionDialog } from '@/components/dialogs/add-inspection-dialog'
import { EditVehicleDialog } from '@/components/dialogs/edit-vehicle-dialog'
import { VehicleFlags } from '@/components/fleet/vehicle-flags'
import { VehicleStatusBadge } from '@/components/fleet/vehicle-status-badge'
import { VehicleDetailTabs } from '@/components/fleet/vehicle-detail-tabs'
import { InfoList } from '@/components/ui/info-list'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { currentPolicyLabel } from '@/lib/fleet/policy-label'
import { isOilChangeOverdue } from '@/lib/fleet/thresholds'
import { cn } from '@/lib/utils/cn'
import { formatKmOrDash } from '@/lib/utils/format-distance'
import { makeModel } from '@/lib/utils/make-model'
import type { DynamicPagePropsT } from '@/types/page'

export default async function VehicleDetailPage({ params }: DynamicPagePropsT) {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/')

  const { id } = await params
  // Arriving straight from the digest mail also counts as looking at the fleet.
  const payload = await getPayload({ config })
  const [, detail] = await Promise.all([
    markSeen(payload, session.user.id, STREAMS.fleet),
    fetchVehicleDetail(Number(id)),
  ])
  if (!detail) notFound()

  const { vehicle, historyByType } = detail
  const policy = currentPolicyLabel(historyByType.INSURANCE)

  return (
    <PageWrapper
      title={vehicle.registration}
      description={`${makeModel(vehicle)}${vehicle.year ? ` · ${vehicle.year}` : ''}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-4">
          <InfoList
            items={[
              { label: 'Status', value: <VehicleStatusBadge status={vehicle.status} /> },
              { label: 'VIN', value: vehicle.vin },
              { label: 'Opony', value: vehicle.tyres },
              { label: 'Ubezpieczenie', value: policy },
              { label: 'Uwagi', value: vehicle.note },
            ]}
          />
          <InfoList
            layout="stacked"
            items={[
              {
                label: 'Od wymiany oleju do ostatniego odczytu przejechano:',
                value: (
                  <span
                    className={cn(
                      'flex items-center gap-1.5',
                      isOilChangeOverdue(vehicle.kmSinceOilChange) &&
                        'text-destructive font-medium',
                    )}
                  >
                    {isOilChangeOverdue(vehicle.kmSinceOilChange) && (
                      <AlertTriangle className="size-4" />
                    )}
                    {formatKmOrDash(vehicle.kmSinceOilChange)}
                  </span>
                ),
              },
              {
                label: 'Do wymiany:',
                value: <VehicleFlags vehicleId={vehicle.id} active={vehicle.activeFlags} />,
              },
            ]}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <EditVehicleDialog vehicle={vehicle} />
          <AddInspectionDialog vehicles={[vehicle]} vehicleId={vehicle.id} />
        </div>
      </div>

      <VehicleDetailTabs historyByType={historyByType} />
    </PageWrapper>
  )
}
