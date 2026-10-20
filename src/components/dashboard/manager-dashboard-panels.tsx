import { fetchVisibleRegisters } from '@/lib/queries/cash-registers'
import { fetchPendingExpenseDrafts } from '@/lib/queries/worker-expense-drafts'
import { fetchRejectedPayouts } from '@/lib/queries/payout-confirmation'
import { UserRegisterStats } from '@/components/dashboard/user-register-stats'
import { PendingExpenseDrafts } from '@/components/worker-expenses/pending-expense-drafts'
import { RejectedPayouts } from '@/components/payouts/rejected-payouts'

// Rendered beside the transfers table: the table's query runs alongside these three reads instead of
// after them.
export async function ManagerDashboardPanels() {
  const [{ registers, isAdminOrOwner }, pendingDrafts, rejectedPayouts] = await Promise.all([
    fetchVisibleRegisters(),
    fetchPendingExpenseDrafts(),
    fetchRejectedPayouts(),
  ])

  return (
    <>
      <UserRegisterStats cashRegisters={registers} showAllRegisters={isAdminOrOwner} />
      <PendingExpenseDrafts drafts={pendingDrafts} />
      <RejectedPayouts payouts={rejectedPayouts} />
    </>
  )
}
