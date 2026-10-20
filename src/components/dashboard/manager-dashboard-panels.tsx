import { fetchVisibleRegisters } from '@/lib/queries/cash-registers'
import { fetchPendingExpenseDrafts } from '@/lib/queries/worker-expense-drafts'
import { fetchRejectedReceipts } from '@/lib/queries/receipt-confirmation'
import { UserRegisterStats } from '@/components/dashboard/user-register-stats'
import { PendingExpenseDrafts } from '@/components/worker-expenses/pending-expense-drafts'
import { RejectedReceipts } from '@/components/receipt-confirmation/rejected-receipts'

// Rendered beside the transfers table: the table's query runs alongside these three reads instead of
// after them.
export async function ManagerDashboardPanels() {
  const [{ registers, isAdminOrOwner }, pendingDrafts, rejectedReceipts] = await Promise.all([
    fetchVisibleRegisters(),
    fetchPendingExpenseDrafts(),
    fetchRejectedReceipts(),
  ])

  return (
    <>
      <UserRegisterStats cashRegisters={registers} showAllRegisters={isAdminOrOwner} />
      <PendingExpenseDrafts drafts={pendingDrafts} />
      <RejectedReceipts receipts={rejectedReceipts} />
    </>
  )
}
