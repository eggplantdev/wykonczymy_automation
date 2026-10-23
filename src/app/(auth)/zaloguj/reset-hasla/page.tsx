import { Suspense } from 'react'
import { ResetPasswordForm } from './reset-password-form'
import { AuthPageLayout } from '@/components/ui/auth-page-layout'

export default function ResetPasswordPage() {
  return (
    <AuthPageLayout title="Nowe hasło" backHref="/zaloguj">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthPageLayout>
  )
}
