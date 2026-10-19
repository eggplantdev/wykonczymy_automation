'use client'

import type { ReactNode } from 'react'
import { Badge, BadgeButton, BADGE_OUTLINE_TONES, type BadgeToneT } from '@/components/ui/badge'
import { DecisionProgressBadge } from '@/components/ui/decision-progress-badge'
import { CardChip } from '@/components/transfers/cards/card-chip'
import { TransferTypeBadge } from '@/components/transfers/transfer-type-badge'
import { DotBadge } from '@/components/ui/dot-badge'
import { COLOR_TOKENS } from '@/styles/color-tokens'
import { SectionPill } from '@/components/worker-reports/section-pill'
import { PayoutStatusBadge } from '@/components/payouts/payout-status-badge'
import { InvestmentStatusBadge } from '@/components/investments/investment-status-badge'
import { AiProgressBadge, AI_PROGRESS_TONES } from '@/components/investments/ai-progress-badge'
import { RoleBadge } from '@/components/users/role-badge'
import { VehicleStatusBadge } from '@/components/fleet/vehicle-status-badge'
import { EquipmentStatusBadge } from '@/components/equipment/equipment-status-badge'
import { AlertBadge } from '@/components/fleet/alert-badge'
import { DraftStatusBadge } from '@/components/worker-expenses/draft-status-badge'
import { WorkerReportStatusBadge } from '@/components/worker-reports/worker-report-status-badge'
import { useTranslation } from '@/hooks/use-translation'
import { ROLES } from '@/lib/auth/roles'
import { INVESTMENT_STATUSES } from '@/lib/constants/investment-status'
import { AI_PROGRESS_STEPS } from '@/lib/constants/investment-ai-stage'
import { TRANSFER_TYPES } from '@/lib/constants/transfers'
import { VEHICLE_STATUSES } from '@/lib/fleet/vehicle-status'
import { EQUIPMENT_STATUSES } from '@/lib/equipment/equipment-status'
import { sectionColorRail } from '@/lib/kosztorys/section-colors'
import { cn } from '@/lib/utils/cn'
import type { TransferRowT } from '@/types/transfers'

const TONES = Object.keys(BADGE_OUTLINE_TONES) as BadgeToneT[]
const DECISIONS = ['pending', 'accepted', 'rejected'] as const

function Row({ title, source, children }: { title: string; source: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-b py-4">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <code className="text-muted-foreground text-xs">{source}</code>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </section>
  )
}

export function BadgeVariants() {
  const transfersTranslator = useTranslation('transfers')

  return (
    <div className="flex flex-col p-4">
      <h1 className="text-xl font-semibold">Warianty badge&apos;y</h1>

      <h2 className="mt-6 text-xs font-semibold tracking-wide uppercase">
        A. Badge (ui/badge.tsx)
      </h2>
      <Row title="Badge — wszystkie tony" source="<Badge tone>">
        {TONES.map((tone) => (
          <Badge key={tone} tone={tone}>
            {tone}
          </Badge>
        ))}
      </Row>
      <Row title="Badge — wszystkie tony, obrys" source='<Badge tone appearance="outline">'>
        {TONES.map((tone) => (
          <Badge key={tone} tone={tone} appearance="outline">
            {tone}
          </Badge>
        ))}
      </Row>
      <Row title="DotBadge — cała paleta" source="ui/dot-badge.tsx">
        {COLOR_TOKENS.map((color) => (
          <DotBadge key={color} color={color}>
            {color}
          </DotBadge>
        ))}
      </Row>
      <Row title="PayoutStatusBadge" source="payouts/payout-status-badge.tsx">
        {DECISIONS.map((status) => (
          <PayoutStatusBadge
            key={status}
            status={status}
            cancelled={false}
            translator={transfersTranslator}
          />
        ))}
        <PayoutStatusBadge status="rejected" cancelled translator={transfersTranslator} />
      </Row>
      <Row title="InvestmentStatusBadge" source="investments/investment-status-badge.tsx">
        {INVESTMENT_STATUSES.map((status) => (
          <InvestmentStatusBadge key={status} status={status} />
        ))}
      </Row>
      <Row title="AiProgressBadge" source="investments/ai-progress-badge.tsx">
        {AI_PROGRESS_STEPS.map((step) => (
          <AiProgressBadge key={step} step={step} />
        ))}
      </Row>
      <Row title="RoleBadge" source="users/role-badge.tsx">
        {ROLES.map((role) => (
          <RoleBadge key={role} role={role}>
            {role}
          </RoleBadge>
        ))}
      </Row>
      <Row title="Vehicle / Equipment status" source="fleet/vehicle-status-badge.tsx, equipment/…">
        {VEHICLE_STATUSES.map((status) => (
          <VehicleStatusBadge key={status} status={status} />
        ))}
        {EQUIPMENT_STATUSES.map((status) => (
          <EquipmentStatusBadge key={status} status={status} />
        ))}
      </Row>
      <Row title="AlertBadge" source="fleet/alert-badge.tsx">
        <AlertBadge title="alert">Przegląd za 3 dni</AlertBadge>
      </Row>
      <Row
        title="DraftStatusBadge / WorkerReportStatusBadge"
        source="worker-expenses/…, worker-reports/…"
      >
        {DECISIONS.map((status) => (
          <DraftStatusBadge key={status} status={status} />
        ))}
        {DECISIONS.map((status) => (
          <WorkerReportStatusBadge
            key={status}
            status={status}
            lineCount={0}
            acceptedLineCount={0}
            rejectedLineCount={0}
          />
        ))}
      </Row>
      <Row title="DecisionProgressBadge" source="ui/decision-progress-badge.tsx">
        <DecisionProgressBadge accepted={3} rejected={1} pending={2} />
      </Row>

      <h2 className="mt-6 text-xs font-semibold tracking-wide uppercase">
        B. Poza Badge — osobny kod
      </h2>
      <Row title="CardChip (obrys, label: wartość)" source="transfers/cards/card-chip.tsx">
        <CardChip kind="register" label="Kasa">
          Główna
        </CardChip>
        <CardChip kind="worker" label="Pracownik">
          Jan
        </CardChip>
        <CardChip kind="category" label="Kategoria">
          Materiały
        </CardChip>
        <CardChip kind="paymentMethod" label="Płatność">
          Gotówka
        </CardChip>
        <CardChip kind="createdBy" label="Dodał">
          Admin
        </CardChip>
      </Row>
      <Row
        title="TransferTypeBadge (wrapper na DotBadge)"
        source="transfers/transfer-type-badge.tsx"
      >
        {TRANSFER_TYPES.map((type) => (
          <TransferTypeBadge
            key={type}
            transfer={{ type, settled: false } as TransferRowT}
            translator={transfersTranslator}
          />
        ))}
      </Row>
      <Row title="SectionPill (kolor z --section-rail)" source="worker-reports/section-pill.tsx">
        {(['blue', 'green', 'purple'] as const).map((color) => (
          <span key={color} className={cn('worker-report', sectionColorRail(color))}>
            <SectionPill name="Łazienka" />
          </span>
        ))}
      </Row>
      <Row title="AI etap — obrys (trigger selecta)" source="investments/ai-stage-select.tsx">
        {AI_PROGRESS_STEPS.map((step) => (
          <Badge key={step} tone={AI_PROGRESS_TONES[step]} appearance="outline">
            {step}
          </Badge>
        ))}
      </Row>
      <Row title="BadgeButton (klikalny badge)" source="ui/badge.tsx">
        <BadgeButton tone="positive">Aktywny</BadgeButton>
        <BadgeButton tone="muted">Nieaktywny</BadgeButton>
      </Row>
    </div>
  )
}
