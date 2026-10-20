import { requireManagementPage } from '@/lib/auth/require-management-page'
import { DesignSystem } from './design-system'

export default async function DesignSystemPage() {
  await requireManagementPage()
  return <DesignSystem />
}
