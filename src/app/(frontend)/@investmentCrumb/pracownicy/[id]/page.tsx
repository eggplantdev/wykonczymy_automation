import { HistoryBackButton } from '@/components/ui/history-back-button'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'
import { isManagementRole } from '@/lib/auth/roles'

export default async function CrumbWorkerDetail() {
  const user = await getCurrentUserJwt()
  if (!user || !isManagementRole(user.role)) return null
  return <HistoryBackButton fallbackHref="/pracownicy" />
}
