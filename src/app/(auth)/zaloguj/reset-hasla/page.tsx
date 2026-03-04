import { ResetPasswordForm } from './reset-password-form'
import Link from 'next/link'

export default function ResetPasswordPage() {
  return (
    <div className="w-full max-w-sm px-4">
      <h1 className="text-foreground mb-6 text-center text-xl font-semibold">Nowe hasło</h1>
      <ResetPasswordForm />
      <Link
        href="/zaloguj"
        className="text-muted-foreground hover:text-foreground mt-4 block text-center text-sm transition-colors"
      >
        Powrót do logowania
      </Link>
    </div>
  )
}
