import { ForgotPasswordForm } from './forgot-password-form'
import { AuthPageLayout } from '@/components/ui/auth-page-layout'

export default function ForgotPasswordPage() {
  return (
    <AuthPageLayout
      title="Resetowanie hasła"
      description="Podaj swój adres email, a wyślemy Ci link do zresetowania hasła."
      backHref="/zaloguj"
    >
      <ForgotPasswordForm />
    </AuthPageLayout>
  )
}
