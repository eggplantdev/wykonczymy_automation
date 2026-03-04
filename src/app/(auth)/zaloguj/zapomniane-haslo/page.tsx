import { ForgotPasswordForm } from './forgot-password-form'
import { AuthLink } from '@/components/ui/auth-link'
import { AuthPageLayout } from '@/components/ui/auth-page-layout'

export default function ForgotPasswordPage() {
  return (
    <AuthPageLayout
      title="Resetowanie hasła"
      description="Podaj swój adres email, a wyślemy Ci link do zresetowania hasła."
    >
      <ForgotPasswordForm />
      <AuthLink href="/zaloguj" className="mt-4 block">
        Powrót do logowania
      </AuthLink>
    </AuthPageLayout>
  )
}
