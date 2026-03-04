import { Suspense } from 'react'
import { ResetPasswordForm } from './reset-password-form'
import { AuthLink } from '@/components/ui/auth-link'
import { AuthPageLayout } from '@/components/ui/auth-page-layout'

export default function ResetPasswordPage() {
  return (
    <AuthPageLayout title="Nowe hasło">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
      <AuthLink href="/zaloguj" className="mt-4 block">
        Powrót do logowania
      </AuthLink>
    </AuthPageLayout>
  )
}
