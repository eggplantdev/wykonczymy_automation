import { requireManagementPage } from '@/lib/auth/require-management-page'
import { BadgeVariants } from './badge-variants'

export default async function BadgeVariantsPage() {
  await requireManagementPage()
  return <BadgeVariants />
}
