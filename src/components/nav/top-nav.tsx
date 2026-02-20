'use client'

import type { ReferenceDataT } from '@/components/dialogs/add-transfer-dialog'
import type { RoleT } from '@/lib/auth/roles'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useTransition } from 'react'
import { LogOut } from 'lucide-react'
import { logoutAction } from '@/lib/actions/auth'
import { ROLE_LABELS } from '@/lib/auth/roles'
import { Button } from '../ui/button'

const AddTransferDialog = dynamic(() =>
  import('@/components/dialogs/add-transfer-dialog').then((m) => ({
    default: m.AddTransferDialog,
  })),
)

const AddDepositDialog = dynamic(() =>
  import('@/components/dialogs/add-deposit-dialog').then((m) => ({
    default: m.AddDepositDialog,
  })),
)

const AddSettlementDialog = dynamic(() =>
  import('@/components/dialogs/add-settlement-dialog').then((m) => ({
    default: m.AddSettlementDialog,
  })),
)

type TopNavPropsT = {
  referenceData?: ReferenceDataT
  userCashRegisterIds?: number[]
  user: {
    id: number
    name: string
    email: string
    role: RoleT
  }
}

export function TopNav({ referenceData, userCashRegisterIds, user }: TopNavPropsT) {
  const [isPending, startTransition] = useTransition()

  const handleLogout = () => {
    startTransition(() => logoutAction())
  }

  return (
    <header className="border-border bg-background sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b px-3">
      {/* Left: app name */}
      <Link href="/" className="text-lg font-semibold">
        Wykonczymy
      </Link>

      {/* Right: action buttons + logout */}
      <div className="flex flex-wrap items-center gap-2">
        {referenceData && (
          <>
            <AddDepositDialog
              referenceData={referenceData}
              userCashRegisterIds={userCashRegisterIds}
            />
            <AddSettlementDialog referenceData={referenceData} />
            <AddTransferDialog
              referenceData={referenceData}
              userCashRegisterIds={userCashRegisterIds}
            />
          </>
        )}
        <div className="border-border hidden items-center gap-2 border-l pl-2 lg:flex">
          <span className="text-foreground text-sm font-medium">{user.name}</span>
          <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-xs">
            {ROLE_LABELS[user.role].pl}
          </span>
        </div>
        <Button variant="outline" onClick={handleLogout} disabled={isPending} aria-label="Wyloguj">
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  )
}
