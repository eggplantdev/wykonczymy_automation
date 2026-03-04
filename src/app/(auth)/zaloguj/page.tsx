import { LoginForm } from './login-form'
import { AuthPageLayout } from '@/components/ui/auth-page-layout'

export default function LoginPage() {
  return (
    <AuthPageLayout title="Zaloguj się">
      <LoginForm />
    </AuthPageLayout>
  )
}
